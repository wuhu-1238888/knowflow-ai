import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentDetailPage from "@/app/documents/[id]/page";
import { chunkHeading } from "@/lib/chunk-format";

/* L3 文档详情页测试(2026-09-13 闭环优化,规格 4.1/4.2/4.3):
   基本信息 + 内容预览 + Chunk 列表(标题提取/摘要回退)/ 404 / 失败重试 /
   failed 状态细分(解析失败 vs 索引失败)。
   useParams 用 hoisted 可变 mock 控制路由 id;fetch 全局打桩(同 rag.test 方式)。 */

const { routeId } = vi.hoisted(() => ({ routeId: { value: "doc-1" } }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: routeId.value }),
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
});
