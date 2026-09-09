/* RAG BFF 代理与 typed client(任务 3.3.1)。
 * 链路:浏览器 → Next.js route handler(同源,无 CORS)→ FastAPI 127.0.0.1:8000。
 * 约定:上游非 2xx → 状态码透传 + 统一可读错误态 {error};网络失败 → 503;超时 → 504。
 * 超时口径:ask 首次调用含模型加载(~60s 实测),上限 120s;后端 LLM 30s 超时待真实 provider 生效。
 */

import { NextResponse } from "next/server";

export const RAG_BASE_URL = "http://127.0.0.1:8000";
export const RAG_TIMEOUT_MS = 120_000;

/** 拒答阈值(与后端 answer_pipeline.py TAU_* 对齐;改动须人拍板并同步两侧)。 */
export const TAU_BY_MODE: Record<string, number> = {
  vector: 0.58,
  hybrid: 0.58,
  hybrid_rerank: 0.3,
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorPayload(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function upstreamDetail(body: unknown): string {
  /* FastAPI 错误体:{"detail": "..."}(400/500)或 {"detail": [{loc,msg}]}(422)。 */
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => (item as { msg?: unknown }).msg)
      .filter((msg): msg is string => typeof msg === "string");
    if (messages.length > 0) {
      return messages.join(";");
    }
  }
  return "";
}

export async function proxyToRag(
  request: Request,
  upstreamPath: string,
  method: "GET" | "POST" | "DELETE",
  timeoutMs: number = RAG_TIMEOUT_MS,
): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(`${RAG_BASE_URL}${upstreamPath}`, {
      method,
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
      body: method === "GET" ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return errorPayload(504, "RAG 服务响应超时,请稍后重试");
    }
    return errorPayload(503, "RAG 服务不可达,请稍后重试");
  }
  let body: unknown = null;
  try {
    body = await upstream.json();
  } catch {
    body = null;
  }
  if (!upstream.ok) {
    const message = upstreamDetail(body) || `上游服务错误(${upstream.status})`;
    return errorPayload(upstream.status, message);
  }
  return NextResponse.json(body);
}

/* ── /api/ask 响应 schema(与后端 main.py 一致)── */

export interface Citation {
  index: number;
  doc_id: string;
  chunk_id: string;
  quote: string;
  /* 富字段(3.3.2):完整 chunk 原文 + 来源 + 展示口径分数(后端按模式计算),
     文档元信息由 /api/ask 补齐(来源抽屉/依据条目展示;文档缺失时回退 doc_id/空串)。 */
  text: string;
  source: string;
  score: number;
  doc_title: string;
  doc_format: string;
  doc_status: string;
  doc_uploaded_at: string;
}

export interface ConflictItem {
  doc_a: string;
  doc_b: string;
  quote_a: string;
  quote_b: string;
}

export interface AskResponse {
  qa_id: string;
  answer: string | null;
  citations: Citation[];
  no_answer: boolean;
  confidence: number;
  conflicts: ConflictItem[] | null;
  mode: string;
  elapsed_ms: number;
}

export type FeedbackRating = "useful" | "useless";

/* ── typed client ── */

export async function askQuestion(
  query: string,
  mode = "hybrid_rerank",
): Promise<AskResponse> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, mode }),
  });
  const body = (await response.json()) as AskResponse | { error?: string };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string }).error ?? "请求失败,请稍后重试",
    );
  }
  return body as AskResponse;
}

/** FR-12 回答反馈:有用/无用,upsert 落库(同 QA 重复提交以最新为准)。 */
export async function sendFeedback(
  qaId: string,
  rating: FeedbackRating,
): Promise<void> {
  const response = await fetch(`/api/qa/${encodeURIComponent(qaId)}/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.error ?? "反馈提交失败,请稍后重试",
    );
  }
}
