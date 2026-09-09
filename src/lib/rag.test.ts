// @vitest-environment node
/* BFF 代理与 typed client L2 直连测试(任务 3.3.1 四类用例:成功 / 404 / 422 / 服务不可达)。
 * 全部通过 vi.stubGlobal("fetch") 打桩,不依赖真实 RAG 服务;route handler 以函数级调用。 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE as deleteDocument } from "@/app/api/documents/[id]/route";
import { POST as postAsk } from "@/app/api/ask/route";
import { ApiError, askQuestion, proxyToRag, RAG_BASE_URL } from "@/lib/rag";

const ASK_BODY = {
  answer: "年假每年 10 天。",
  citations: [
    { index: 1, doc_id: "doc-hr-05", chunk_id: "doc-hr-05-0", quote: "年假每年 10 天。" },
  ],
  no_answer: false,
  confidence: 0.83,
  conflicts: null,
  mode: "hybrid_rerank",
  elapsed_ms: 1234,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxyToRag / api/ask", () => {
  it("成功:200 透传完整 schema,且转发 body 与路径正确", async () => {
    const mock = stubFetch(async () => jsonResponse(ASK_BODY));
    const request = new Request("http://localhost:3001/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "年假有几天?", mode: "hybrid_rerank" }),
    });
    const response = await postAsk(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ASK_BODY);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/ask`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(Buffer.from(init.body as ArrayBuffer).toString())).toEqual({
      query: "年假有几天?",
      mode: "hybrid_rerank",
    });
  });

  it("404:状态码与可读错误态透传({error})", async () => {
    stubFetch(async () => jsonResponse({ detail: "Not Found" }, 404));
    const response = await postAsk(
      new Request("http://localhost:3001/api/ask", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });

  it("422:FastAPI 校验错误 detail 数组 → 可读错误态", async () => {
    stubFetch(async () =>
      jsonResponse(
        { detail: [{ loc: ["body", "query"], msg: "field required" }] },
        422,
      ),
    );
    const response = await proxyToRag(
      new Request("http://localhost:3001/x", { method: "POST", body: "{}" }),
      "/api/ask",
      "POST",
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "field required" });
  });

  it("服务不可达:fetch 网络异常 → 503 可读错误态", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const response = await postAsk(
      new Request("http://localhost:3001/api/ask", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "RAG 服务不可达,请稍后重试" });
  });

  it("超时:abort → 504 可读错误态", async () => {
    stubFetch(async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted due to timeout");
          error.name = "TimeoutError";
          reject(error);
        });
      }),
    );
    const response = await proxyToRag(
      new Request("http://localhost:3001/x", { method: "POST", body: "{}" }),
      "/api/ask",
      "POST",
      10,
    );
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "RAG 服务响应超时,请稍后重试" });
  });
});

describe("其余代理路由(路径与 method 转发)", () => {
  it("DELETE /api/documents/:id 转发带 id", async () => {
    const mock = stubFetch(async () => jsonResponse({ ok: true }));
    const response = await deleteDocument(
      new Request("http://localhost:3001/api/documents/doc-x", { method: "DELETE" }),
      { params: Promise.resolve({ id: "doc-x" }) },
    );
    expect(response.status).toBe(200);
    expect((mock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      `${RAG_BASE_URL}/api/documents/doc-x`,
    );
    expect((mock.mock.calls[0] as [string, RequestInit])[1].method).toBe("DELETE");
  });
});

describe("typed client askQuestion", () => {
  it("成功:解析为 AskResponse 并带 query/mode 请求体", async () => {
    const mock = stubFetch(async () => jsonResponse(ASK_BODY));
    const result = await askQuestion("年假有几天?");
    expect(result.answer).toBe("年假每年 10 天。");
    expect(result.citations).toHaveLength(1);
    expect(mock).toHaveBeenCalledWith(
      "/api/ask",
      expect.objectContaining({ method: "POST" }),
    );
    const init = (mock.mock.calls[0] as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toEqual({
      query: "年假有几天?",
      mode: "hybrid_rerank",
    });
  });

  it("失败:非 2xx 抛出 ApiError(状态码 + 可读信息)", async () => {
    stubFetch(async () => jsonResponse({ error: "RAG 服务不可达,请稍后重试" }, 503));
    await expect(askQuestion("问题")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "RAG 服务不可达,请稍后重试",
    });
    await expect(askQuestion("问题")).rejects.toBeInstanceOf(ApiError);
  });
});
