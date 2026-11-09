/* RAG BFF 代理与 typed client(任务 3.3.1)。
 * 链路:浏览器 → Next.js route handler(同源,无 CORS)→ FastAPI 127.0.0.1:8000。
 * 部署平台前后端分容器时,直连失败自动回退「同域 + /rag 前缀」经平台网关访问 API 容器
 * (对应后端 main.py 的双前缀挂载 /api/* 与 /rag/*)。
 * 约定:上游非 2xx → 状态码透传 + 统一可读错误态 {error};网络失败 → 503;超时 → 504。
 * 超时口径:ask 首次调用含模型加载(~60s 实测),上限 120s;后端 LLM 30s 超时待真实 provider 生效。
 */

import { NextResponse } from "next/server";

export const RAG_TIMEOUT_MS = 120_000;

/**
 * RAG 服务地址(服务端 BFF 使用,不进浏览器)。
 * 默认 127.0.0.1:8000(本地单机架构);部署平台(如 PocketBay 前后端分容器)通过
 * RAG_BASE_URL 环境变量注入容器间可访问的内部地址。
 * 未注入且直连失败时,proxyToRag 自动回退「同域 + /rag 前缀」(见 edgeFallbackUrl)。
 */
export function getRagBaseUrl(): string {
  return process.env.RAG_BASE_URL ?? "http://127.0.0.1:8000";
}

/**
 * 部署平台边缘网关兜底地址:后端 FastAPI 将同一组路由同时挂在 /api/* 与 /rag/* 下,
 * Next 未定义 /rag/* 路由,平台网关会把这类路径转发给 API 容器。
 * 因此直连失败时,回退到「请求同域 + /rag 前缀」即可经网关触达 FastAPI。
 */
export function edgeFallbackUrl(origin: string, upstreamPath: string): string {
  return `${origin}${upstreamPath.replace(/^\/api(?=\/|$)/, "/rag")}`;
}

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
  const headers = {
    "content-type": request.headers.get("content-type") ?? "application/json",
  };
  const requestBody = method === "GET" ? undefined : await request.arrayBuffer();
  const attempt = (url: string) =>
    fetch(url, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(timeoutMs),
    });

  let upstream: Response;
  let usedFallback = false;
  try {
    upstream = await attempt(`${getRagBaseUrl()}${upstreamPath}`);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      // 直连超时不再回退(网关路径大概率同样超时),避免总耗时翻倍。
      return errorPayload(504, "RAG 服务响应超时,请稍后重试");
    }
    // 直连网络失败(连接拒绝/DNS 等):前后端分容器部署时,回退「同域 + /rag 前缀」
    // 经平台边缘网关访问 API 容器;本地单机直连正常时不会走到这里。
    usedFallback = true;
    try {
      upstream = await attempt(
        edgeFallbackUrl(new URL(request.url).origin, upstreamPath),
      );
    } catch (fallbackError) {
      if (fallbackError instanceof Error && fallbackError.name === "TimeoutError") {
        return errorPayload(504, "RAG 服务响应超时,请稍后重试");
      }
      return errorPayload(503, "RAG 服务不可达,请稍后重试");
    }
  }
  let body: unknown = null;
  try {
    body = await upstream.json();
  } catch {
    body = null;
  }
  if (!upstream.ok) {
    const message = upstreamDetail(body);
    if (!message && usedFallback) {
      // 回退路径上的非 FastAPI 错误页(如网关/Next 的 404 HTML)→ 视为服务不可达。
      return errorPayload(503, "RAG 服务不可达,请稍后重试");
    }
    return errorPayload(upstream.status, message || `上游服务错误(${upstream.status})`);
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
  /** 拒答两态(2026-09-13 闭环优化):no_evidence = 完全无依据;
      insufficient = 检索到低分相关内容但不足以确定答案。可选字段兼容旧夹具。 */
  refusal_reason?: "no_evidence" | "insufficient" | null;
  /** 拒答时检索到的命中数(insufficient 时 > 0)。 */
  relevant_hits?: number;
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
      (body as { error?: string }).error ?? "回答生成失败,请稍后重试。",
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

/** FR-12 反馈读取(3.4.6 状态恢复):挂载时恢复该回答的已提交反馈;
    该 QA 从未被反馈(404 或 rating 缺失)→ null,视为未评价。 */
export async function getFeedback(qaId: string): Promise<FeedbackRating | null> {
  const response = await fetch(`/api/qa/${encodeURIComponent(qaId)}/feedback`);
  if (response.status === 404) {
    return null;
  }
  const body = (await response.json().catch(() => null)) as {
    rating?: string | null;
    error?: string;
  } | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error ?? "反馈状态加载失败,请稍后重试",
    );
  }
  return body?.rating === "useful" || body?.rating === "useless"
    ? body.rating
    : null;
}

/* ── /api/documents 文档库(3.3.3:上传/列表/删除/重建索引,FR-01/FR-09)── */

export interface DocumentInfo {
  id: string;
  title: string;
  file_type: string;
  status: "parsing" | "indexed" | "failed";
  uploaded_at: string;
  synthetic: number;
  chunk_count: number;
  /** 失败原因留存(2026-09-13):解析失败:/索引失败: 前缀;成功为 null。 */
  last_error?: string | null;
}

/** 文档详情 chunk(分块原文,按 chunk_order 排序)。 */
export interface DocumentChunkInfo {
  id: string;
  order: number;
  text: string;
}

/** 文档详情(GET /api/documents/:id;基本信息 + 内容预览 + chunks 列表)。 */
export interface DocumentDetail extends DocumentInfo {
  last_error: string | null;
  /** 源文件解析后的前 2000 字;解析失败/文件缺失为 null(chunks 兜底)。 */
  preview: string | null;
  chunks: DocumentChunkInfo[];
}

export interface DocumentListResponse {
  items: DocumentInfo[];
  total: number;
  page: number;
  page_size: number;
}

export interface IngestResponse {
  doc_id: string;
  title: string;
  file_type: string;
  status: "indexed";
  chunk_count: number;
}

/** 文档列表(GET /api/documents;演示规模 page_size=100 一页拉全,分页参数保留)。 */
export async function listDocuments(
  page = 1,
  pageSize = 100,
): Promise<DocumentListResponse> {
  const response = await fetch(`/api/documents?page=${page}&page_size=${pageSize}`);
  const body = (await response.json().catch(() => null)) as
    | DocumentListResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "文档列表加载失败,请稍后重试",
    );
  }
  return body as DocumentListResponse;
}

/** 上传文档(POST /api/ingest,multipart;422 = 解析失败,行保留 failed 可重试)。 */
export async function uploadDocument(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/ingest", { method: "POST", body: form });
  const body = (await response.json().catch(() => null)) as
    | IngestResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "上传失败,请稍后重试",
    );
  }
  return body as IngestResponse;
}

/** 文档详情(GET /api/documents/:id;2026-09-13 闭环优化,详情页与来源抽屉定位)。 */
export async function getDocument(id: string): Promise<DocumentDetail> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`);
  const body = (await response.json().catch(() => null)) as
    | DocumentDetail
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "文档详情加载失败,请稍后重试",
    );
  }
  return body as DocumentDetail;
}

/** 删除文档(DELETE /api/documents/:id;FR-09 人显式触发,前端走二次确认模态)。 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(response.status, body?.error ?? "删除失败,请稍后重试");
  }
}

/** 重建索引(POST /api/documents/:id/reindex;解析失败行的「重试」同用此端点)。 */
export async function reindexDocument(id: string): Promise<IngestResponse> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}/reindex`, {
    method: "POST",
  });
  const body = (await response.json().catch(() => null)) as
    | IngestResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "重建索引失败,请稍后重试",
    );
  }
  return body as IngestResponse;
}

/* ── /api/eval 评测(3.3.4:运行/列表/明细;指标只来自 run 结果,禁止虚构)── */

export type EvalRunStatus = "running" | "completed" | "failed";

/** 指标口径:completed 行 = hit_at_5 + mrr;failed 行 = {error}。 */
export type EvalMetrics = { hit_at_5: { hits: number; total: number }; mrr: number };

export interface EvalRunSummary {
  run_id: string;
  mode: string;
  params_hash: string;
  doc_commit: string;
  created_at: string;
  status: EvalRunStatus;
  metrics: EvalMetrics | { error?: string };
  has_per_case: boolean;
}

export interface EvalCaseHit {
  chunk_id: string;
  doc_id: string;
  source: string;
  score: number;
  rerank_score: number | null;
  vec_score: number | null;
}

export interface EvalCaseDetail {
  case_id: string;
  category: string;
  query: string;
  expected_behavior: string;
  expected_doc_ids: string[];
  in_metrics: boolean;
  hits: EvalCaseHit[];
  rank_of_first_expected: number | null;
  hit: boolean | null;
  rr: number | null;
  skipped: boolean;
  error: string | null;
}

export interface EvalRunDetail extends EvalRunSummary {
  per_case?: EvalCaseDetail[];
}

export interface StartEvalResponse {
  run_ids: string[];
  created_at: string;
}

/** 全部评测运行摘要(新批次在前;同批三行 created_at 相同,前端按批聚合)。 */
export async function listEvalRuns(): Promise<EvalRunSummary[]> {
  const response = await fetch("/api/eval/runs");
  const body = (await response.json().catch(() => null)) as
    | { runs: EvalRunSummary[] }
    | { error?: string }
    | null;
  if (!response.ok || !body || !("runs" in body)) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "评测记录加载失败,请稍后重试",
    );
  }
  return body.runs;
}

/** 启动三模式评测(POST /api/eval/run,后台约数分钟;运行中再点 → 409)。 */
export async function startEvalRun(): Promise<StartEvalResponse> {
  const response = await fetch("/api/eval/run", { method: "POST" });
  const body = (await response.json().catch(() => null)) as
    | StartEvalResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "启动评测失败,请稍后重试",
    );
  }
  return body as StartEvalResponse;
}

/** 单次运行明细(逐例 per_case,RunList 展开用;历史 CLI 批次无明细)。 */
export async function getEvalRun(runId: string): Promise<EvalRunDetail> {
  const response = await fetch(`/api/eval/runs/${encodeURIComponent(runId)}`);
  const body = (await response.json().catch(() => null)) as
    | EvalRunDetail
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? "评测明细加载失败,请稍后重试",
    );
  }
  return body as EvalRunDetail;
}
