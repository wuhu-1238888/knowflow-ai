"""KnowFlow AI RAG 服务 — 单一入口(FastAPI)。

7 个模块(解析 / 索引 / 检索 / 问答 / 评测 / 文档管理 / 日志)随实施计划逐步挂载,
当前:健康检查 + POST /api/ask(3.2.6)。

create_app 工厂支持测试注入(service/pipeline/repo);生产路径懒加载真实模型
(首次 ask 才加载 bge-m3,vector/hybrid 不加载 reranker,hybrid_rerank 按需加载)。
ask 30s 上限 = LLM 调用超时(真实 provider 骨架实现时生效);本地推理同步执行,
无外部调用。错误码按 technical-design「API 层约定」。
"""

import json
import time
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .answer_pipeline import ASK_MODES, AnswerPipeline
from .db import init_db
from .indexing import BgeM3Embedder, LanceIndex
from .llm_adapter import get_provider
from .repository import Repository, new_id, now_iso
from .retrieval import BgeReranker, RetrievalService, TOP_K


class AskRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = "hybrid_rerank"


class FeedbackRequest(BaseModel):
    rating: Literal["useful", "useless"]


def create_app(service=None, pipeline=None, repo=None) -> FastAPI:
    app = FastAPI(title="KnowFlow AI RAG Service", version="0.1.0")
    state = {
        "service": service,      # 测试注入的检索服务
        "pipeline": pipeline,    # 测试注入的问答管线
        "repo": repo,            # 测试注入的仓库
        # 生产懒加载(共享同一 embedder/index,reranker 按模式按需)
        "embedder": None,
        "index": None,
        "service_plain": None,
        "service_rerank": None,
    }

    def _repo() -> Repository:
        if state["repo"] is None:
            init_db()
            state["repo"] = Repository()
        return state["repo"]

    def _pipeline() -> AnswerPipeline:
        if state["pipeline"] is None:
            state["pipeline"] = AnswerPipeline(get_provider())
        return state["pipeline"]

    def _service(mode: str) -> RetrievalService:
        if state["service"] is not None:
            return state["service"]
        if state["embedder"] is None:
            state["embedder"] = BgeM3Embedder()
            state["index"] = LanceIndex(state["embedder"])
            state["service_plain"] = RetrievalService(
                state["index"], state["embedder"], reranker=None
            )
        if mode == "hybrid_rerank":
            if state["service_rerank"] is None:
                state["service_rerank"] = RetrievalService(
                    state["index"], state["embedder"], reranker=BgeReranker()
                )
            return state["service_rerank"]
        return state["service_plain"]

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "knowflow-rag"}

    @app.post("/api/ask")
    def ask(req: AskRequest) -> dict:
        query = req.query.strip()
        if not query:
            raise HTTPException(status_code=400, detail="query 不能为空")
        if req.mode not in ASK_MODES:
            raise HTTPException(
                status_code=400,
                detail=f"非法 mode: {req.mode}(支持: {', '.join(ASK_MODES)})",
            )
        started = time.monotonic()
        try:
            hits = _service(req.mode).search(query, mode=req.mode, top_k=TOP_K)
        except Exception as exc:  # 检索/模型加载异常 → 500(Stage 08 错误码)
            raise HTTPException(
                status_code=500, detail=f"检索异常: {type(exc).__name__}"
            ) from exc
        result = _pipeline().answer(query, hits, req.mode)
        elapsed_ms = round((time.monotonic() - started) * 1000)
        # 引用富数据:附加文档元信息(来源抽屉/依据条目展示;文档缺失时回退 doc_id)
        citations = []
        for c in result.citations:
            meta = _repo().get_document(c["doc_id"])
            citations.append(
                {
                    **c,
                    "doc_title": meta["title"] if meta else c["doc_id"],
                    "doc_format": meta["file_type"] if meta else "",
                    "doc_status": meta["status"] if meta else "",
                    "doc_uploaded_at": meta["uploaded_at"] if meta else "",
                }
            )
        qa_id = new_id("qa-")
        # 审计最小落点:QA 日志全字段落库(含拒答/降级);qa_id 随响应返回供反馈关联(FR-12)
        _repo().add_qa_log(
            {
                "id": qa_id,
                "query": query,
                "answer": result.answer,
                "citations_json": json.dumps(citations, ensure_ascii=False),
                "no_answer": 1 if result.no_answer else 0,
                "mode": req.mode,
                "created_at": now_iso(),
            }
        )
        return {
            "qa_id": qa_id,
            "answer": result.answer,
            "citations": citations,
            "no_answer": result.no_answer,
            "confidence": result.confidence,
            "conflicts": result.conflicts,
            "mode": req.mode,
            "elapsed_ms": elapsed_ms,
        }

    @app.post("/api/qa/{qa_id}/feedback")
    def feedback(qa_id: str, req: FeedbackRequest) -> dict:
        """FR-12 回答反馈:有用/无用,upsert 落库;QA 不存在 → 404。"""
        repo = _repo()
        if not repo.qa_exists(qa_id):
            raise HTTPException(status_code=404, detail="QA 记录不存在")
        repo.set_feedback(qa_id, req.rating, now_iso())
        return {"qa_id": qa_id, "rating": req.rating}

    return app


app = create_app()
