// @vitest-environment node
/* BFF 代理与 typed client L2 直连测试(任务 3.3.1 四类用例:成功 / 404 / 422 / 服务不可达)。
 * 全部通过 vi.stubGlobal("fetch") 打桩,不依赖真实 RAG 服务;route handler 以函数级调用。 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getDocuments } from "@/app/api/documents/route";
import { DELETE as deleteDocumentRoute } from "@/app/api/documents/[id]/route";
import { POST as postReindex } from "@/app/api/documents/[id]/reindex/route";
import { GET as getEvalRunRoute } from "@/app/api/eval/runs/[id]/route";
import { POST as postAsk } from "@/app/api/ask/route";
import { POST as postIngest } from "@/app/api/ingest/route";
import { GET as getFeedbackRoute, POST as postFeedback } from "@/app/api/qa/[id]/feedback/route";
import {
  ApiError,
  askQuestion,
  deleteDocument,
  getEvalRun,
  getFeedback,
  listDocuments,
  listEvalRuns,
  proxyToRag,
  RAG_BASE_URL,
  reindexDocument,
  sendFeedback,
  startEvalRun,
  uploadDocument,
} from "@/lib/rag";

const ASK_BODY = {
  qa_id: "qa-1",
  answer: "年假每年 10 天。",
  citations: [
    {
      index: 1,
      doc_id: "doc-hr-05",
      chunk_id: "doc-hr-05-0",
      quote: "年假每年 10 天。",
      text: "年假每年 10 天,司龄每满一年增加 1 天。",
      source: "hybrid",
      score: 0.83,
      doc_title: "员工手册",
      doc_format: "md",
      doc_status: "indexed",
      doc_uploaded_at: "2026-09-01T00:00:00",
    },
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
    const response = await deleteDocumentRoute(
      new Request("http://localhost:3001/api/documents/doc-x", { method: "DELETE" }),
      { params: Promise.resolve({ id: "doc-x" }) },
    );
    expect(response.status).toBe(200);
    expect((mock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      `${RAG_BASE_URL}/api/documents/doc-x`,
    );
    expect((mock.mock.calls[0] as [string, RequestInit])[1].method).toBe("DELETE");
  });

  it("POST /api/qa/:id/feedback 转发带 id 与 rating 请求体(FR-12)", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ qa_id: "qa-1", rating: "useful" }),
    );
    const response = await postFeedback(
      new Request("http://localhost:3001/api/qa/qa-1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: "useful" }),
      }),
      { params: Promise.resolve({ id: "qa-1" }) },
    );
    expect(response.status).toBe(200);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/qa/qa-1/feedback`);
    expect(init.method).toBe("POST");
    expect(
      JSON.parse(Buffer.from(init.body as ArrayBuffer).toString()),
    ).toEqual({ rating: "useful" });
  });

  it("POST /api/qa/:id/feedback 404:QA 记录不存在透传可读错误态", async () => {
    stubFetch(async () => jsonResponse({ detail: "QA 记录不存在" }, 404));
    const response = await postFeedback(
      new Request("http://localhost:3001/api/qa/qa-ghost/feedback", {
        method: "POST",
        body: JSON.stringify({ rating: "useful" }),
      }),
      { params: Promise.resolve({ id: "qa-ghost" }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "QA 记录不存在" });
  });

  it("GET /api/qa/:id/feedback 转发带 id 且无请求体(3.4.6 状态恢复)", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ qa_id: "qa-1", rating: null }),
    );
    const response = await getFeedbackRoute(
      new Request("http://localhost:3001/api/qa/qa-1/feedback"),
      { params: Promise.resolve({ id: "qa-1" }) },
    );
    expect(response.status).toBe(200);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/qa/qa-1/feedback`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
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

describe("typed client sendFeedback(FR-12)", () => {
  it("成功:POST /api/qa/:id/feedback 带 rating 请求体", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ qa_id: "qa-1", rating: "useful" }),
    );
    await sendFeedback("qa-1", "useful");
    expect(mock).toHaveBeenCalledWith(
      "/api/qa/qa-1/feedback",
      expect.objectContaining({ method: "POST" }),
    );
    const init = (mock.mock.calls[0] as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toEqual({ rating: "useful" });
  });

  it("失败:非 2xx 抛出 ApiError(状态码 + 可读信息)", async () => {
    stubFetch(async () => jsonResponse({ error: "QA 记录不存在" }, 404));
    await expect(sendFeedback("qa-9", "useless")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "QA 记录不存在",
    });
  });
});

describe("typed client getFeedback(3.4.6 状态恢复)", () => {
  it("成功:解析 rating 为有用/无用", async () => {
    stubFetch(async () => jsonResponse({ qa_id: "qa-1", rating: "useless" }));
    await expect(getFeedback("qa-1")).resolves.toBe("useless");
  });

  it("无记录:rating null → null(未评价)", async () => {
    stubFetch(async () => jsonResponse({ qa_id: "qa-1", rating: null }));
    await expect(getFeedback("qa-1")).resolves.toBeNull();
  });

  it("QA 不存在:404 → null(视为未评价,不抛错)", async () => {
    stubFetch(async () => jsonResponse({ error: "QA 记录不存在" }, 404));
    await expect(getFeedback("qa-ghost")).resolves.toBeNull();
  });

  it("其他非 2xx(如 503)→ ApiError(可读信息)", async () => {
    stubFetch(async () => jsonResponse({ error: "RAG 服务不可达,请稍后重试" }, 503));
    await expect(getFeedback("qa-1")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "RAG 服务不可达,请稍后重试",
    });
  });
});

const DOC_ITEM = {
  id: "doc-1",
  title: "员工手册.md",
  file_type: "md",
  status: "indexed",
  uploaded_at: "2026-09-05T10:30:00",
  synthetic: false,
  chunk_count: 3,
};

const INGEST_BODY = {
  doc_id: "doc-1",
  title: "员工手册.md",
  file_type: "md",
  status: "indexed",
  chunk_count: 3,
};

describe("文档管理 BFF 路由(3.3.3)", () => {
  it("GET /api/documents 透传分页 query 到 FastAPI", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ items: [DOC_ITEM], total: 1, page: 2, page_size: 50 }),
    );
    const response = await getDocuments(
      new Request("http://localhost:3001/api/documents?page=2&page_size=50"),
    );
    expect(response.status).toBe(200);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/documents?page=2&page_size=50`);
    expect(init.method).toBe("GET");
  });

  it("POST /api/ingest 转发(multipart 字节 + content-type 透传)", async () => {
    const mock = stubFetch(async () => jsonResponse(INGEST_BODY));
    const file = new File(["demo"], "a.md", { type: "text/markdown" });
    const form = new FormData();
    form.append("file", file);
    const response = await postIngest(
      new Request("http://localhost:3001/api/ingest", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/ingest`);
    expect(init.method).toBe("POST");
    // proxyToRag 读 arrayBuffer 转发原始字节,multipart 边界与文件名由 content-type 携带
    expect(init.body).toBeInstanceOf(ArrayBuffer);
    expect(init.headers).toMatchObject({
      "content-type": expect.stringContaining("multipart/form-data"),
    });
    const bytes = Buffer.from(init.body as ArrayBuffer).toString("utf-8");
    expect(bytes).toContain('filename="a.md"');
    expect(bytes).toContain("demo");
  });

  it("POST /api/documents/:id/reindex 转发带 id", async () => {
    const mock = stubFetch(async () => jsonResponse(INGEST_BODY));
    const response = await postReindex(
      new Request("http://localhost:3001/api/documents/doc-1/reindex", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "doc-1" }) },
    );
    expect(response.status).toBe(200);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/documents/doc-1/reindex`);
    expect(init.method).toBe("POST");
  });
});

describe("typed client 文档管理(3.3.3)", () => {
  it("listDocuments:GET /api/documents?page=&page_size= 并解析 items/total", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ items: [DOC_ITEM], total: 1, page: 1, page_size: 100 }),
    );
    const result = await listDocuments(1, 100);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].chunk_count).toBe(3);
    expect(result.total).toBe(1);
    expect(mock).toHaveBeenCalledWith("/api/documents?page=1&page_size=100");
  });

  it("listDocuments:失败 → ApiError", async () => {
    stubFetch(async () => jsonResponse({ error: "数据库错误" }, 500));
    await expect(listDocuments()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "数据库错误",
    });
  });

  it("uploadDocument:POST /api/ingest 以 FormData 传文件(不手动设 content-type)", async () => {
    const mock = stubFetch(async () => jsonResponse(INGEST_BODY));
    const file = new File(["demo"], "a.md", { type: "text/markdown" });
    const result = await uploadDocument(file);
    expect(result.doc_id).toBe("doc-1");
    expect(result.chunk_count).toBe(3);
    expect(mock).toHaveBeenCalledWith(
      "/api/ingest",
      expect.objectContaining({ method: "POST" }),
    );
    const init = (mock.mock.calls[0] as [string, RequestInit])[1];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
  });

  it("uploadDocument:422 解析失败 → ApiError(可读信息,页面刷新呈现 failed 行)", async () => {
    stubFetch(async () => jsonResponse({ error: "文件解析失败:无法提取文本" }, 422));
    await expect(uploadDocument(new File(["x"], "a.md"))).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "文件解析失败:无法提取文本",
    });
  });

  it("deleteDocument:DELETE /api/documents/:id;404 → ApiError", async () => {
    const mock = stubFetch(async () => jsonResponse({ deleted: "doc-1" }));
    await deleteDocument("doc-1");
    expect(mock).toHaveBeenCalledWith(
      "/api/documents/doc-1",
      expect.objectContaining({ method: "DELETE" }),
    );

    // client 层按 BFF 契约取 {error}(detail→error 转换由 route 层负责,前文已测)
    stubFetch(async () => jsonResponse({ error: "文档不存在" }, 404));
    await expect(deleteDocument("ghost")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "文档不存在",
    });
  });

  it("reindexDocument:POST /api/documents/:id/reindex;500 → ApiError", async () => {
    const mock = stubFetch(async () => jsonResponse(INGEST_BODY));
    await reindexDocument("doc-1");
    expect(mock).toHaveBeenCalledWith(
      "/api/documents/doc-1/reindex",
      expect.objectContaining({ method: "POST" }),
    );

    stubFetch(async () => jsonResponse({ error: "源文件不存在" }, 500));
    await expect(reindexDocument("doc-1")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "源文件不存在",
    });
  });
});

const EVAL_SUMMARY = {
  run_id: "run-1",
  mode: "vector",
  params_hash: "abc123def4567890",
  doc_commit: "abc1234",
  created_at: "2026-09-10T08:00:00+00:00",
  status: "completed",
  metrics: { hit_at_5: { hits: 12, total: 12 }, mrr: 0.9583 },
  has_per_case: true,
};

const EVAL_PER_CASE = [
  {
    case_id: "C01",
    category: "假期制度",
    query: "年假有几天?",
    expected_behavior: "answer",
    expected_doc_ids: ["doc-hr-05"],
    in_metrics: true,
    hits: [],
    rank_of_first_expected: 1,
    hit: true,
    rr: 1.0,
    skipped: false,
    error: null,
  },
];

describe("评测 BFF 路由与 typed client(3.3.4)", () => {
  it("GET /api/eval/runs/:id 转发带 run_id", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ ...EVAL_SUMMARY, per_case: EVAL_PER_CASE }),
    );
    const response = await getEvalRunRoute(
      new Request("http://localhost:3001/api/eval/runs/run-1"),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    expect(response.status).toBe(200);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${RAG_BASE_URL}/api/eval/runs/run-1`);
    expect(init.method).toBe("GET");
  });

  it("listEvalRuns:GET /api/eval/runs 解析 runs 数组;失败 → ApiError", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ runs: [EVAL_SUMMARY] }),
    );
    const result = await listEvalRuns();
    expect(result).toHaveLength(1);
    expect(result[0].metrics).toEqual({ hit_at_5: { hits: 12, total: 12 }, mrr: 0.9583 });
    expect(mock).toHaveBeenCalledWith("/api/eval/runs");

    stubFetch(async () => jsonResponse({ error: "数据库错误" }, 500));
    await expect(listEvalRuns()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "数据库错误",
    });
  });

  it("startEvalRun:POST /api/eval/run 解析 202 响应;409 → ApiError(可读信息)", async () => {
    const mock = stubFetch(async () =>
      jsonResponse(
        { run_ids: ["run-a", "run-b", "run-c"], created_at: "2026-09-10T08:00:00+00:00" },
        202,
      ),
    );
    const result = await startEvalRun();
    expect(result.run_ids).toHaveLength(3);
    expect(mock).toHaveBeenCalledWith(
      "/api/eval/run",
      expect.objectContaining({ method: "POST" }),
    );

    stubFetch(async () =>
      jsonResponse({ error: "已有评测正在运行,请等待完成" }, 409),
    );
    await expect(startEvalRun()).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "已有评测正在运行,请等待完成",
    });
  });

  it("getEvalRun:GET /api/eval/runs/:id 解析明细含 per_case;404 → ApiError", async () => {
    const mock = stubFetch(async () =>
      jsonResponse({ ...EVAL_SUMMARY, per_case: EVAL_PER_CASE }),
    );
    const detail = await getEvalRun("run-1");
    expect(detail.per_case).toHaveLength(1);
    expect(detail.per_case?.[0].case_id).toBe("C01");
    expect(mock).toHaveBeenCalledWith("/api/eval/runs/run-1");

    stubFetch(async () => jsonResponse({ error: "评测运行不存在" }, 404));
    await expect(getEvalRun("run-ghost")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "评测运行不存在",
    });
  });
});
