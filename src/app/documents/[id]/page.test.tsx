import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentDetailPage from "@/app/documents/[id]/page";
import { chunkHeading } from "@/lib/chunk-format";

/* L3 文档详情页测试(2026-09-13 闭环优化,规格 4.1/4.2/4.3):
   基本信息 + 内容预览 + Chunk 列表(标题提取/摘要回退)/ 404 / 失败重试 /
   failed 状态细分(解析失败 vs 索引失败)/ 返回上下文(来源感知)。
   useParams/useSearchParams 用 hoisted 可变 mock 控制路由;useRouter 记录
   back/push 调用;fetch 全局打桩(同 rag.test 方式)。 */

const { routeId, searchParams, routerMock } = vi.hoisted(() => ({
  routeId: { value: "doc-1" },
  searchParams: { value: "" },
  routerMock: { back: vi.fn(), push: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: routeId.value }),
  useSearchParams: () => new URLSearchParams(searchParams.value),
  useRouter: () => routerMock,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const DETAIL = {
  id: "doc-1",
  title: "员工手册.md",
  file_type: "md",
  status: "indexed",
  uploaded_at: "2026-09-05T10:30:00",
  synthetic: false,
  chunk_count: 2,
  last_error: null,
  preview: "前言\n这是一篇演示文档,内容如下。",
  chunks: [
    { id: "doc-1-0", order: 0, text: "# 年假制度\n新员工入职第一年年假为 8 天。" },
    {
      id: "doc-1-1",
      order: 1,
      text: "病假需提供医院证明,每年累计上限 5 天,超出部分按事假处理。",
    },
  ],
};

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  searchParams.value = "";
  routerMock.back.mockClear();
  routerMock.push.mockClear();
});

describe("chunkHeading", () => {
  it("提取首个 Markdown 标题(前缀文本存在时也命中)", () => {
    expect(chunkHeading("# 年假制度\n正文")).toBe("年假制度");
    expect(chunkHeading("前文\n## 报销标准\n正文")).toBe("报销标准");
  });

  it("无标题 → null(UI 回退首行摘要)", () => {
    expect(chunkHeading("普通段落,没有标题。")).toBeNull();
  });
});

describe("DocumentDetailPage", () => {
  it("渲染基本信息/内容预览/Chunk 列表(标题提取 + 摘要回退 + Chunk ID)", async () => {
    stubFetch(async () => jsonResponse(DETAIL));
    render(<DocumentDetailPage />);

    expect(await screen.findByText("员工手册.md")).toBeTruthy();
    // 基本信息:格式/状态/上传时间/分块数
    expect(screen.getByText("MD")).toBeTruthy();
    expect(screen.getByText("已索引")).toBeTruthy();
    expect(screen.getByText("2026-09-05")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    // 内容预览:源文件解析原文
    expect(screen.getByText(/前言\s+这是一篇演示文档,内容如下。/)).toBeTruthy();
    // Chunk 列表:Chunk 顺序 + ID + 标题提取(章节)
    expect(screen.getByText("分块内容(2)")).toBeTruthy();
    expect(screen.getByText("Chunk 0")).toBeTruthy();
    expect(screen.getByText("doc-1-0")).toBeTruthy();
    expect(screen.getByText("年假制度")).toBeTruthy();
    // 无标题 chunk 回退首行摘要(超 24 字截断)
    expect(screen.getByText("病假需提供医院证明,每年累计上限 5 天,超出部…")).toBeTruthy();
    // 返回文档库链接
    expect(
      screen.getByRole("link", { name: /返回文档库/ }).getAttribute("href"),
    ).toBe("/documents");
  });

  it("failed 状态(2026-09-13 细分):索引失败徽标 + 失败原因 + 无预览/无分块兜底", async () => {
    routeId.value = "doc-bad";
    stubFetch(async () =>
      jsonResponse({
        ...DETAIL,
        id: "doc-bad",
        status: "failed",
        chunk_count: 0,
        last_error: "索引失败: RuntimeError",
        preview: null,
        chunks: [],
      }),
    );
    render(<DocumentDetailPage />);

    expect(await screen.findByText("员工手册.md")).toBeTruthy();
    expect(screen.getByText("索引失败")).toBeTruthy();
    expect(screen.queryByText("解析失败")).toBeNull();
    expect(screen.getByText(/失败原因:索引失败: RuntimeError/)).toBeTruthy();
    expect(screen.getByText("暂无预览(文档解析失败或源文件缺失)")).toBeTruthy();
    expect(screen.getByText("分块内容(0)")).toBeTruthy();
    expect(screen.getByText("暂无分块(文档解析失败或尚未完成索引)")).toBeTruthy();
  });

  it("解析失败(无「索引失败」前缀):徽标保持「解析失败」", async () => {
    routeId.value = "doc-parse";
    stubFetch(async () =>
      jsonResponse({
        ...DETAIL,
        id: "doc-parse",
        status: "failed",
        last_error: "解析失败: 无法提取文本",
        chunk_count: 0,
        preview: null,
        chunks: [],
      }),
    );
    render(<DocumentDetailPage />);

    expect(await screen.findByText("员工手册.md")).toBeTruthy();
    expect(screen.getByText("解析失败")).toBeTruthy();
    expect(screen.queryByText("索引失败")).toBeNull();
  });

  it("404:文档不存在或已被删除 + 返回文档库", async () => {
    routeId.value = "ghost";
    stubFetch(async () => jsonResponse({ error: "文档不存在" }, 404));
    render(<DocumentDetailPage />);

    expect(await screen.findByText("文档不存在或已被删除")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "返回文档库" }).getAttribute("href"),
    ).toBe("/documents");
  });

  it("加载失败(非 404):错误提示 + 重试成功恢复", async () => {
    routeId.value = "doc-1";
    const impl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(DETAIL));
    stubFetch(impl);
    render(<DocumentDetailPage />);

    expect(await screen.findByText("文档详情加载失败,请稍后重试")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("员工手册.md")).toBeTruthy();
    expect(impl).toHaveBeenCalledTimes(2);
  });

  it("布局(2026-09-13):顶部呼吸空间 pt-6 lg:pt-8,返回入口与标题间 gap-6", async () => {
    stubFetch(async () => jsonResponse(DETAIL));
    const { container } = render(<DocumentDetailPage />);
    await screen.findByText("员工手册.md");

    const root = container.firstElementChild;
    expect(root?.className).toContain("pt-6");
    expect(root?.className).toContain("lg:pt-8");
    expect(root?.className).toContain("gap-6");
  });

  it("布局(2026-09-13):四列信息摘要等宽均匀 + 每列内容水平居中", async () => {
    stubFetch(async () => jsonResponse(DETAIL));
    const { container } = render(<DocumentDetailPage />);
    await screen.findByText("员工手册.md");

    const dl = container.querySelector("dl");
    expect(dl?.className).toContain("grid-cols-2");
    expect(dl?.className).toContain("lg:grid-cols-4");
    const cells = dl?.querySelectorAll(":scope > div");
    expect(cells).toHaveLength(4);
    cells?.forEach((cell) =>
      expect(cell.className).toContain("text-center"),
    );
  });
});

describe("DocumentDetailPage 返回上下文(2026-09-13)", () => {
  it("知识问答进入(?from=qa + 来源标记 qa):显示「返回知识问答」,点击 router.back()", async () => {
    searchParams.value = "from=qa";
    sessionStorage.setItem("kf:nav:last-source", "qa");
    stubFetch(async () => jsonResponse(DETAIL));
    render(<DocumentDetailPage />);
    await screen.findByText("员工手册.md");

    const back = screen.getByRole("link", { name: "← 返回知识问答" });
    expect(back.getAttribute("href")).toBe("/");
    fireEvent.click(back);
    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("?from=qa 但无来源标记(新标签页直接打开):兜底 push 到知识问答", async () => {
    searchParams.value = "from=qa";
    stubFetch(async () => jsonResponse(DETAIL));
    render(<DocumentDetailPage />);
    await screen.findByText("员工手册.md");

    fireEvent.click(screen.getByRole("link", { name: "← 返回知识问答" }));
    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/");
  });

  it("文档库进入(来源标记 docs):「返回文档库」,点击 router.back() 保留列表浏览状态", async () => {
    sessionStorage.setItem("kf:nav:last-source", "docs");
    stubFetch(async () => jsonResponse(DETAIL));
    render(<DocumentDetailPage />);
    await screen.findByText("员工手册.md");

    const back = screen.getByRole("link", { name: "← 返回文档库" });
    expect(back.getAttribute("href")).toBe("/documents");
    fireEvent.click(back);
    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("直接访问(无 from 无标记):默认「返回文档库」,push /documents", async () => {
    stubFetch(async () => jsonResponse(DETAIL));
    render(<DocumentDetailPage />);
    await screen.findByText("员工手册.md");

    fireEvent.click(screen.getByRole("link", { name: "← 返回文档库" }));
    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/documents");
  });
});
