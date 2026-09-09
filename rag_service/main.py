"""KnowFlow AI RAG 服务 — 单一入口(FastAPI)。

7 个模块(解析 / 索引 / 检索 / 问答 / 评测 / 文档管理 / 日志)随实施计划逐步挂载,
当前:健康检查 + POST /api/ask(3.2.6)+ 文档管理四端点(3.3.3)。

create_app 工厂支持测试注入(service/pipeline/repo/index);生产路径懒加载真实模型
(首次 ask/ingest 才加载 bge-m3,vector/hybrid 不加载 reranker,hybrid_rerank 按需加载)。
ask 30s 上限 = LLM 调用超时(真实 provider 骨架实现时生效);本地推理同步执行,
无外部调用。错误码按 technical-design「API 层约定」:400 参数错误 / 404 资源不存在 /
422 解析失败(行保留 failed 状态,表格可重试)/ 500 内部异常。
"""

import json
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from .answer_pipeline import ASK_MODES, AnswerPipeline
from .chunker import chunk_text
from .config import get_uploads_dir
from .db import init_db
from .indexing import BgeM3Embedder, LanceIndex
from .llm_adapter import get_provider
from .parsing import SUPPORTED_EXTENSIONS, EmptyTextError, ParsingError, parse_file
from .repository import Repository, new_id, now_iso
from .retrieval import BgeReranker, RetrievalService, TOP_K


class AskRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = "hybrid_rerank"


class FeedbackRequest(BaseModel):
    rating: Literal["useful", "useless"]


def create_app(service=None, pipeline=None, repo=None, index=None) -> FastAPI:
    app = FastAPI(title="KnowFlow AI RAG Service", version="0.1.0")
    state = {
        "service": service,      # 测试注入的检索服务
        "pipeline": pipeline,    # 测试注入的问答管线
        "repo": repo,            # 测试注入的仓库
        "index": index,          # 测试注入的向量索引(检索与文档管理共享)
        # 生产懒加载(共享同一 embedder/index,reranker 按模式按需)
        "embedder": None,
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

    def _index() -> LanceIndex:
        if state["index"] is None:
            state["embedder"] = BgeM3Embedder()
            state["index"] = LanceIndex(state["embedder"])
        return state["index"]

    def _service(mode: str) -> RetrievalService:
        if state["service"] is not None:
            return state["service"]
        _index()  # 首次 ask/ingest 才加载真实模型(懒加载)
        if mode == "hybrid_rerank":
            if state["service_rerank"] is None:
                state["service_rerank"] = RetrievalService(
                    state["index"], state["embedder"], reranker=BgeReranker()
                )
            return state["service_rerank"]
        if state["service_plain"] is None:
            state["service_plain"] = RetrievalService(
                state["index"], state["embedder"], reranker=None
            )
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

    # ── 文档管理(3.3.3:上传 / 列表 / 删除 / 重建索引,FR-01/FR-09)──

    def _set_status(doc_id: str, status: str) -> None:
        doc = _repo().get_document(doc_id)
        if doc is not None:
            _repo().upsert_document({**doc, "status": status})

    def _chunk_rows(doc_id: str, text: str) -> list[dict]:
        """与 LanceIndex.index_document 同源分块,镜像落元数据库 chunks 表。"""
        return [
            {
                "id": f"{doc_id}-{c.order}",
                "doc_id": doc_id,
                "text": c.text,
                "chunk_order": c.order,
                "metadata": "{}",
            }
            for c in chunk_text(text)
        ]

    def _parse_and_index(doc_id: str, filename: str, content: bytes) -> tuple[str, int]:
        """解析 → 分块 → 索引 → chunks 落库;失败抛 422(调用方负责 failed 回写)。

        返回 (标题, chunk 数)。
        """
        try:
            result = parse_file(filename, content)
        except (ParsingError, EmptyTextError) as exc:
            raise HTTPException(status_code=422, detail=f"解析失败: {exc}") from exc
        count = _index().index_document(doc_id, result.text)
        _index().ensure_fts()  # 增量行编入全文倒排(hybrid 检索依赖)
        repo = _repo()
        repo.delete_chunks(doc_id)
        repo.add_chunks(_chunk_rows(doc_id, result.text))
        return result.title, count

    @app.get("/api/documents")
    def list_documents(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
    ) -> dict:
        """文档列表与状态(technical-design:?page=&page_size=,默认 20)。

        chunk_count 从元数据库读(3.3.3 chunks 落库),打开列表不触发模型加载;
        source_path 属内部路径,不出现在响应。
        """
        repo = _repo()
        docs = repo.list_documents()
        total = len(docs)
        start = (page - 1) * page_size
        items = [
            {
                key: doc[key]
                for key in ("id", "title", "file_type", "status", "uploaded_at", "synthetic")
            }
            | {"chunk_count": repo.count_chunks(doc["id"])}
            for doc in docs[start : start + page_size]
        ]
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @app.post("/api/ingest")
    def ingest(file: UploadFile = File(...)) -> dict:
        """上传文档 → 解析 → 分块 → 索引;返回 doc_id 与最终状态。

        源文件保存至 runtime/uploads(重建索引时重新读取);解析失败行保留
        failed 状态(表格可重试),上传副本不删除。首次上传会加载 bge-m3。
        """
        filename = file.filename or "unnamed.txt"
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的格式: {ext or '(无扩展名)'}(支持: {', '.join(SUPPORTED_EXTENSIONS)})",
            )
        content = file.file.read()
        if not content.strip():
            raise HTTPException(status_code=400, detail="文件为空,拒绝上传")
        doc_id = new_id("doc-")
        uploads = get_uploads_dir()
        uploads.mkdir(parents=True, exist_ok=True)
        saved_path = uploads / f"{doc_id}{ext}"
        saved_path.write_bytes(content)
        repo = _repo()
        repo.upsert_document(
            {
                "id": doc_id,
                "title": Path(filename).stem,
                "file_type": ext.lstrip("."),
                "status": "parsing",
                "uploaded_at": now_iso(),
                "source_path": str(saved_path),
                "synthetic": 0,  # 用户上传 = 非演示数据
            }
        )
        try:
            title, count = _parse_and_index(doc_id, filename, content)
        except HTTPException:
            _set_status(doc_id, "failed")
            raise
        repo.upsert_document({**repo.get_document(doc_id), "title": title, "status": "indexed"})
        return {
            "doc_id": doc_id,
            "title": title,
            "file_type": ext.lstrip("."),
            "status": "indexed",
            "chunk_count": count,
        }

    @app.delete("/api/documents/{doc_id}")
    def delete_document(doc_id: str) -> dict:
        """删除文档(FR-09,人显式触发):元数据 + chunks 级联 + 向量行 + 上传副本。

        演示文档源文件属仓库资产,绝不删除;仅清理 runtime/uploads 下的副本。
        """
        repo = _repo()
        doc = repo.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="文档不存在")
        _index().delete_document(doc_id)
        repo.delete_document(doc_id)
        src = Path(doc["source_path"])
        if src.parent == get_uploads_dir() and src.is_file():
            src.unlink(missing_ok=True)
        return {"deleted": doc_id}

    @app.post("/api/documents/{doc_id}/reindex")
    def reindex_document(doc_id: str) -> dict:
        """重建索引(人显式触发,FR-09):重读源文件 → 解析 → 索引 → 状态回写。

        解析失败行的「重试」复用本端点;失败仍 422 + failed 状态。
        """
        repo = _repo()
        doc = repo.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="文档不存在")
        src = Path(doc["source_path"])
        if not src.is_file():
            _set_status(doc_id, "failed")
            raise HTTPException(status_code=500, detail="源文件不存在,无法重建索引")
        try:
            content = src.read_bytes()
        except OSError as exc:
            _set_status(doc_id, "failed")
            raise HTTPException(status_code=500, detail=f"源文件读取失败: {exc}") from exc
        _set_status(doc_id, "parsing")
        try:
            title, count = _parse_and_index(doc_id, src.name, content)
        except HTTPException:
            _set_status(doc_id, "failed")
            raise
        repo.upsert_document({**doc, "title": title, "status": "indexed"})
        return {
            "doc_id": doc_id,
            "title": title,
            "file_type": doc["file_type"],
            "status": "indexed",
            "chunk_count": count,
        }

    return app


app = create_app()
