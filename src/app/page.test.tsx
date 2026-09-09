import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AskPage from "@/app/page";

/* L3 问答页状态机测试:idle / loading / 回答 / 拒答 / 冲突 / 失败,
   直接 stub 全局 fetch(同 rag.test.ts 方式),断言请求体中的 query 与 mode。
   2026-09-09 人拍板:页面不暴露检索策略切换——断言无 radiogroup 且恒以默认
   hybrid_rerank 提交;元信息行不出现工程调试值(最高分/耗时)。 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ANSWER_RESPONSE = {
  answer: "新员工入职第一年享有 **8 天** 年假。",
  citations: [
    { index: 1, doc_id: "staff-handbook", chunk_id: "staff-handbook#0", quote: "入职第一年年假为 8 天。" },
  ],
  no_answer: false,
  confidence: 0.66,
  conflicts: null,
  mode: "hybrid_rerank",
  elapsed_ms: 2300,
};

const REFUSE_RESPONSE = {
  answer: null,
  citations: [],
  no_answer: true,
  confidence: 0.12,
  conflicts: null,
  mode: "hybrid_rerank",
  elapsed_ms: 1900,
};

const CONFLICT_RESPONSE = {
  answer: "关于报销上限,两份文档口径不一致,以下并列呈现。",
  citations: [],
  no_answer: false,
  confidence: 0.7,
  conflicts: [
    { doc_a: "员工手册", doc_b: "差旅制度", quote_a: "市内交通费每天上限 100 元。", quote_b: "市内交通费每天上限 150 元。" },
  ],
  mode: "hybrid_rerank",
  elapsed_ms: 2600,
};

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function requestBody(mock: ReturnType<typeof stubFetch>, callIndex = 0) {
  const [url, init] = mock.mock.calls[callIndex] as [string, RequestInit];
  return JSON.parse(Buffer.from(init.body as ArrayBuffer).toString("utf-8"));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AskPage idle 态", () => {
  it("渲染输入框、3 个示例问题与提问按钮(空输入时禁用),且无检索策略切换入口", () => {
    render(<AskPage />);
    expect(screen.getByLabelText("提问内容")).toBeTruthy();
    expect(screen.getByRole("button", { name: "年假有几天?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "市内交通费每天报销上限是多少?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "公司有宠物寄养福利吗?" })).toBeTruthy();
    const submit = screen.getByRole("button", { name: "提问" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // 检索策略不暴露给普通用户(2026-09-09 人拍板):无分段切换、无模式术语
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByText("混合+重排")).toBeNull();
    expect(screen.queryByText("向量")).toBeNull();
  });
});

describe("AskPage 回答流", () => {
  it("点击示例问题 → 请求 /api/ask(默认 hybrid_rerank)→ 渲染回答、元信息与依据", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(ANSWER_RESPONSE));
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    expect(await screen.findByText(/入职第一年享有 8 天 年假/)).toBeTruthy();

    const input = screen.getByLabelText("提问内容") as HTMLTextAreaElement;
    expect(input.value).toBe("年假有几天?");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // 客户端走同源 BFF(见 src/lib/rag.ts),后端地址只存在于服务端 route 内部
    expect(url).toBe("/api/ask");
    expect(init.method).toBe("POST");
    expect(requestBody(fetchMock)).toEqual({ query: "年假有几天?", mode: "hybrid_rerank" });

    // AnswerSheet:元信息行只有用户价值信息,无工程调试值(最高分/耗时)
    expect(screen.getByText("已基于企业知识库检索")).toBeTruthy();
    expect(screen.getByText((_, el) => el?.textContent === "依据 1 条")).toBeTruthy();
    expect(screen.queryByText(/最高分/)).toBeNull();
    expect(screen.queryByText(/耗时/)).toBeNull();
    expect(screen.getByText("AI 回答")).toBeTruthy();
    expect(screen.getByText(/入职第一年年假为 8 天/)).toBeTruthy();
    expect(screen.getByText(/staff-handbook \/ staff-handbook#0/)).toBeTruthy();
  });

  it("Enter 提交,Shift+Enter 不提交", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(ANSWER_RESPONSE));
    render(<AskPage />);

    const input = screen.getByLabelText("提问内容") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "年假有几天?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText(/入职第一年享有 8 天 年假/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loading 态显示「AI 生成中」胶囊,完成后切换为回答", async () => {
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    render(<AskPage />);

    const input = screen.getByLabelText("提问内容") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "年假有几天?" } });
    fireEvent.click(screen.getByRole("button", { name: "提问" }));

    expect(screen.getByText("AI 生成中")).toBeTruthy();
    expect(screen.getByText(/首次回答约需 1 分钟/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "提问" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    resolveFetch(jsonResponse(ANSWER_RESPONSE));
    expect(await screen.findByText(/入职第一年享有 8 天 年假/)).toBeTruthy();
    expect(screen.queryByText("AI 生成中")).toBeNull();
  });
});

describe("AskPage 拒答 / 冲突 / 失败", () => {
  it("拒答渲染拒答卡:依据 0 条,无工程调试值(分数/阈值)", async () => {
    stubFetch(async () => jsonResponse(REFUSE_RESPONSE));
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "公司有宠物寄养福利吗?" }));
    expect(await screen.findByText("知识库中未找到答案")).toBeTruthy();
    expect(screen.getByText("依据 0 条")).toBeTruthy();
    expect(screen.getByText(/联系知识库管理员/)).toBeTruthy();
    expect(screen.queryByText(/最高相关度/)).toBeNull();
    expect(screen.queryByText(/阈值/)).toBeNull();
  });

  it("conflicts 非空时在回答下方渲染冲突面板", async () => {
    stubFetch(async () => jsonResponse(CONFLICT_RESPONSE));
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "市内交通费每天报销上限是多少?" }));
    expect(await screen.findByText("口径不一致")).toBeTruthy();
    expect(screen.getByText(/KnowFlow 不替您选边/)).toBeTruthy();
    expect(screen.getByText(/上限 100 元/)).toBeTruthy();
    expect(screen.getByText(/上限 150 元/)).toBeTruthy();
  });

  it("网络失败渲染错误卡;重试成功后恢复", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    expect(await screen.findByText("回答失败")).toBeTruthy();
    // 浏览器侧网络失败(非 BFF 结构化错误)显示通用文案;BFF 的 503/504 文案由 route 层保证
    expect(screen.getByText("请求失败,请稍后重试")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText(/入职第一年享有 8 天 年假/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
