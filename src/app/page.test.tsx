import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AskPage from "@/app/page";

/* L3 问答页状态机测试:idle / loading / 回答 / 拒答 / 冲突 / 失败,
   直接 stub 全局 fetch(同 rag.test.ts 方式),断言请求体中的 query 与 mode。
   2026-09-09 人拍板:页面不暴露检索策略切换——断言无 radiogroup 且恒以默认
   hybrid_rerank 提交;元信息行不出现工程调试值(最高分/耗时)。
   3.4.6 起 AnswerSheet 挂载会 GET /api/qa/:id/feedback 恢复反馈状态,
   由 stubFetchWithFeedback 统一回 {rating:null},业务断言只数 ask/提交。 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ANSWER_RESPONSE = {
  qa_id: "qa-test-1",
  answer: "新员工入职第一年享有 **8 天** 年假[1]。",
  citations: [
    {
      index: 1,
      doc_id: "staff-handbook",
      chunk_id: "staff-handbook#0",
      quote: "入职第一年年假为 8 天。",
      text: "入职第一年年假为 8 天。",
      source: "hybrid",
      score: 0.66,
      doc_title: "员工手册",
      doc_format: "md",
      doc_status: "indexed",
      doc_uploaded_at: "2026-09-01T00:00:00",
    },
  ],
  no_answer: false,
  confidence: 0.66,
  conflicts: null,
  mode: "hybrid_rerank",
  elapsed_ms: 2300,
};

const REFUSE_RESPONSE = {
  qa_id: "qa-test-2",
  answer: null,
  citations: [],
  no_answer: true,
  confidence: 0.12,
  conflicts: null,
  mode: "hybrid_rerank",
  elapsed_ms: 1900,
};

const CONFLICT_RESPONSE = {
  qa_id: "qa-test-3",
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

/** 3.4.6:AnswerSheet 挂载会 GET /api/qa/:id/feedback 恢复持久化反馈。
   该请求一律回 {rating:null}(未评价),链式 mock 只计业务请求(ask/反馈提交)。 */
function stubFetchWithFeedback(
  impl: (url: string, init: RequestInit) => Promise<Response>,
) {
  const mock = vi.fn(async (url: string, init: RequestInit) => {
    if (String(url).includes("/feedback") && (init.method ?? "GET") === "GET") {
      return jsonResponse({ rating: null });
    }
    return impl(url, init);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** 仅 /api/ask 调用(反馈 GET/POST 不计入业务请求断言)。 */
function askCalls(mock: ReturnType<typeof stubFetchWithFeedback>) {
  return mock.mock.calls.filter(([url]) => String(url) === "/api/ask");
}

function requestBody(calls: [string, RequestInit][], callIndex = 0) {
  const [, init] = calls[callIndex];
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

  it("页头标题「知识问答」带一行克制的副标题", () => {
    render(<AskPage />);
    expect(
      screen.getByText("企业知识助手,基于企业知识库回答问题"),
    ).toBeTruthy();
  });

  it("页面级垂直节奏:顶部呼吸空间 pt-6 lg:pt-12 + 区块间统一 gap-6(2026-09-09 人拍板)", () => {
    const { container } = render(<AskPage />);
    const root = container.firstElementChild;
    expect(root?.className).toContain("pt-6");
    expect(root?.className).toContain("lg:pt-12");
    expect(root?.className).toContain("gap-6");
  });
});

describe("AskPage 回答流", () => {
  it("点击示例问题 → 请求 /api/ask(默认 hybrid_rerank)→ 渲染回答、元信息与依据", async () => {
    const fetchMock = stubFetchWithFeedback(async () => jsonResponse(ANSWER_RESPONSE));
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    expect(await screen.findByText(/入职第一年享有 8 天 年假/)).toBeTruthy();

    const input = screen.getByLabelText("提问内容") as HTMLTextAreaElement;
    expect(input.value).toBe("年假有几天?");

    // ask + 挂载反馈恢复 GET(3.4.6;GET 在挂载 effect 中发起,等待其落位)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // 客户端走同源 BFF(见 src/lib/rag.ts),后端地址只存在于服务端 route 内部
    expect(url).toBe("/api/ask");
    expect(init.method).toBe("POST");
    expect(requestBody(askCalls(fetchMock))).toEqual({ query: "年假有几天?", mode: "hybrid_rerank" });

    // AnswerSheet:元信息行只有用户价值信息,无工程调试值(最高分/耗时)
    expect(screen.getByText("已基于企业知识库检索")).toBeTruthy();
    expect(screen.getByText((_, el) => el?.textContent === "依据 1 条")).toBeTruthy();
    expect(screen.queryByText(/最高分/)).toBeNull();
    expect(screen.queryByText(/耗时/)).toBeNull();
    expect(screen.getByText("AI 回答")).toBeTruthy();
    // 正文 [1] 标记渲染为可点引用 chip,依据条目展示文档标题/片段/来源/分数
    expect(screen.getByRole("button", { name: "查看来源 [1]" })).toBeTruthy();
    expect(screen.getByText("员工手册")).toBeTruthy();
    expect(screen.getByText(/入职第一年年假为 8 天/)).toBeTruthy();
    expect(screen.getByText("相关度 0.66")).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看原文" })).toBeTruthy();
  });

  it("Enter 提交,Shift+Enter 不提交", async () => {
    const fetchMock = stubFetchWithFeedback(async () => jsonResponse(ANSWER_RESPONSE));
    render(<AskPage />);

    const input = screen.getByLabelText("提问内容") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "年假有几天?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText(/入职第一年享有 8 天 年假/);
    expect(askCalls(fetchMock)).toHaveLength(1);
  });

  it("loading 态显示「AI 生成中」胶囊,完成后切换为回答", async () => {
    let resolveFetch!: (response: Response) => void;
    // 仅 /api/ask 挂起(控制加载态);挂载反馈恢复 GET 由 helper 立即返回
    stubFetchWithFeedback(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
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

describe("AskPage 重新生成与回答版本管理(FR-11,3.4.4)", () => {
  it("首次回答:最新主卡带「最新」标与版本标注,不出现「上一版回答」", async () => {
    stubFetchWithFeedback(async () => jsonResponse(ANSWER_RESPONSE));
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    expect(screen.getByText("最新")).toBeTruthy();
    expect(screen.getByText("v1 · 刚刚生成")).toBeTruthy();
    expect(screen.queryByText("上一版回答")).toBeNull();
  });

  it("重新生成:卡内加载态(无首次提问胶囊);成功后新回答最新 v2,旧回答折叠为上一版", async () => {
    let resolveSecond!: (response: Response) => void;
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const fetchMock = stubFetchWithFeedback(impl);
    render(<AskPage />);
    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);

    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    // 重新生成的加载态在最新卡片内,不显示首次提问胶囊,也不伪造多阶段
    expect(screen.getByText("正在重新生成回答…")).toBeTruthy();
    expect(screen.getByText("正在检索企业知识库并生成回答")).toBeTruthy();
    expect(screen.queryByText("AI 生成中")).toBeNull();

    resolveSecond(
      jsonResponse({
        ...ANSWER_RESPONSE,
        qa_id: "qa-test-4",
        answer: "重新生成的回答[1]。",
      }),
    );
    await screen.findByText(/重新生成的回答/);
    expect(askCalls(fetchMock)).toHaveLength(2);
    // 新回答 = 唯一主卡(最新 v2);旧回答默认折叠,正文不可见,不与新回答平级
    expect(screen.getByText("v2 · 刚刚生成")).toBeTruthy();
    expect(screen.getByRole("button", { name: /上一版回答/ })).toBeTruthy();
    expect(screen.queryByText(/入职第一年享有 8 天 年假/)).toBeNull();
    // 展开上一版 → 旧回答可见
    fireEvent.click(screen.getByRole("button", { name: /上一版回答/ }));
    expect(screen.getByText(/入职第一年享有 8 天 年假/)).toBeTruthy();
    // 第二次请求仍带同一问题与默认策略
    expect(requestBody(askCalls(fetchMock), 1)).toEqual({
      query: "年假有几天?",
      mode: "hybrid_rerank",
    });
  });

  it("连续重新生成:v3 最新,v2 降为上一版,v1 让位(版本序号连续)", async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({ ...ANSWER_RESPONSE, qa_id: "qa-a", answer: "第二版回答[1]。" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ ...ANSWER_RESPONSE, qa_id: "qa-b", answer: "第三版回答[1]。" }),
      );
    stubFetchWithFeedback(impl);
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    await screen.findByText(/第二版回答/);
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    await screen.findByText(/第三版回答/);

    expect(screen.getByText("v3 · 刚刚生成")).toBeTruthy();
    // 上一版槽 = v2(被 v3 顶下来的最新版本),v1 不再保留(MVP 口径)
    expect(screen.getByRole("button", { name: /v2/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /上一版回答/ }));
    expect(screen.getByText(/第二版回答/)).toBeTruthy();
    expect(screen.queryByText(/入职第一年享有 8 天 年假/)).toBeNull();
  });

  it("新旧内容一致:明确提示,不复制旧卡片(仅一张主卡,版本不变)", async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ ...ANSWER_RESPONSE, qa_id: "qa-new" }));
    const fetchMock = stubFetchWithFeedback(impl);
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(
      await screen.findByText("已完成重新生成,本次回答与上一版一致。"),
    ).toBeTruthy();
    expect(askCalls(fetchMock)).toHaveLength(2);
    expect(screen.getAllByText(/入职第一年享有 8 天 年假/)).toHaveLength(1);
    expect(screen.getAllByText("AI 回答")).toHaveLength(1);
    expect(screen.getByText("v1 · 刚刚生成")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /上一版回答/ })).toBeNull();
  });

  it("重新生成失败:错误卡显示,最新回答内容与版本恢复", async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    stubFetchWithFeedback(impl);
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(await screen.findByText("回答失败")).toBeTruthy();
    // 卡内加载态消失,原回答恢复,无「上一版回答」(失败不产生版本)
    expect(screen.queryByText("正在重新生成回答…")).toBeNull();
    expect(screen.getByText(/入职第一年享有 8 天 年假/)).toBeTruthy();
    expect(screen.getByText("v1 · 刚刚生成")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /上一版回答/ })).toBeNull();
  });

  it("重新生成得到拒答:拒答卡为当前结果,原回答降级「上一版回答」", async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ ...REFUSE_RESPONSE, qa_id: "qa-refuse-2" }));
    stubFetchWithFeedback(impl);
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(await screen.findByText("知识库中未找到答案")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /上一版回答/ }));
    expect(screen.getByText(/入职第一年享有 8 天 年假/)).toBeTruthy();
  });

  it("冲突随版本存储:新版本冲突更新,旧版本冲突随上一版展开呈现(不串版本)", async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(CONFLICT_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ ...ANSWER_RESPONSE, qa_id: "qa-plain" }));
    stubFetchWithFeedback(impl);
    render(<AskPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "市内交通费每天报销上限是多少?" }),
    );
    expect(await screen.findByText("发现 2 份文档存在口径差异")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    // 新版本无冲突 → 主卡无 Trust 提示
    expect(screen.queryByText(/发现 .* 份文档存在口径差异/)).toBeNull();
    // 旧版本冲突随上一版展开呈现(默认仍收起,不串到新版本)
    fireEvent.click(screen.getByRole("button", { name: /上一版回答/ }));
    expect(screen.getByText("发现 2 份文档存在口径差异")).toBeTruthy();
    expect(screen.queryByText(/上限 150 元/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看冲突来源" }));
    expect(screen.getByText(/上限 150 元/)).toBeTruthy();
  });

  it("有用:点选后 POST /api/qa/:qa_id/feedback 并进入选中态(页面层 FR-12)", async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ qa_id: "qa-test-1", rating: "useful" }));
    const fetchMock = stubFetchWithFeedback(impl);
    render(<AskPage />);
    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    await screen.findByText(/入职第一年享有 8 天 年假/);
    fireEvent.click(screen.getByRole("button", { name: "有用" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "有用" }) as HTMLButtonElement)
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    const post = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/feedback") && (init?.method ?? "GET") === "POST",
    )!;
    expect(post[0]).toBe("/api/qa/qa-test-1/feedback");
    expect(JSON.parse(String(post[1].body))).toEqual({ rating: "useful" });
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

  it("conflicts 非空:回答卡内 Trust 提示默认收起,点击展开冲突来源(3.4.5)", async () => {
    stubFetchWithFeedback(async () => jsonResponse(CONFLICT_RESPONSE));
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "市内交通费每天报销上限是多少?" }));
    // 默认仅轻量提示,不展开两个完整来源,不重复渲染来源卡
    expect(await screen.findByText("发现 2 份文档存在口径差异")).toBeTruthy();
    expect(screen.getByText(/KnowFlow 不替您选边/)).toBeTruthy();
    expect(screen.queryByText(/上限 100 元/)).toBeNull();
    // 展开后可见冲突双方来源(无 citation 时降级为 doc_id 标题)
    fireEvent.click(screen.getByRole("button", { name: "查看冲突来源" }));
    expect(screen.getByText(/上限 100 元/)).toBeTruthy();
    expect(screen.getByText(/上限 150 元/)).toBeTruthy();
    expect(screen.getByText("员工手册")).toBeTruthy();
    expect(screen.getByText("差旅制度")).toBeTruthy();
  });

  it("网络失败渲染错误卡;重试成功后恢复", async () => {
    const impl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(ANSWER_RESPONSE));
    const fetchMock = stubFetchWithFeedback(impl);
    render(<AskPage />);

    fireEvent.click(screen.getByRole("button", { name: "年假有几天?" }));
    expect(await screen.findByText("回答失败")).toBeTruthy();
    // 浏览器侧网络失败(非 BFF 结构化错误)显示通用文案;BFF 的 503/504 文案由 route 层保证
    expect(screen.getByText("请求失败,请稍后重试")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText(/入职第一年享有 8 天 年假/)).toBeTruthy();
    expect(askCalls(fetchMock)).toHaveLength(2);
  });
});
