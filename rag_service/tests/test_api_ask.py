"""POST /api/ask L2 直连(TestClient + 注入假服务/假 provider/临时库)。

四类用例:成功 / 非法参数 400 / 空索引→拒答 / LLM 异常→降级话术;
QA 日志落库断言(审计最小落点)。
"""

import json

from fastapi.testclient import TestClient

from rag_service.answer_pipeline import DEGRADE_MESSAGE, AnswerPipeline
from rag_service.db import init_db
from rag_service.main import create_app
from rag_service.mock_provider import MockProvider
from rag_service.repository import Repository
from rag_service.retrieval import SearchHit

TEXT_HR05 = "年假每年 10 天,司龄每满一年增加 1 天,上限 15 天。"


class FakeService:
    def __init__(self, hits: list[SearchHit]):
        self._hits = hits
        self.calls = 0

    def search(self, query: str, mode: str, top_k: int = 8):
        self.calls += 1
        return self._hits


class BoomProvider:
    def generate(self, query, chunks):
        raise RuntimeError("LLM 挂了")


def good_hit() -> SearchHit:
    return SearchHit(
        chunk_id="doc-hr-05-0",
        doc_id="doc-hr-05",
        text=TEXT_HR05,
        score=0.0328,
        source="hybrid",
        rerank_score=0.83,
        vec_score=0.71,
    )


def make_client(tmp_path, hits=None, provider=None):
    init_db(db_path=tmp_path / "knowflow.db")
    repo = Repository(db_path=tmp_path / "knowflow.db")
    service = FakeService(hits if hits is not None else [good_hit()])
    pipeline = AnswerPipeline(provider if provider is not None else MockProvider())
    return TestClient(create_app(service=service, pipeline=pipeline, repo=repo)), repo


def test_ask_success_full_schema(tmp_path):
    client, repo = make_client(tmp_path)
    resp = client.post("/api/ask", json={"query": "年假有几天?", "mode": "hybrid_rerank"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == "年假每年 10 天,司龄每满一年增加 1 天,上限 15 天。"
    assert body["no_answer"] is False
    assert body["confidence"] == 0.83
    assert body["conflicts"] is None
    assert body["mode"] == "hybrid_rerank"
    assert isinstance(body["elapsed_ms"], int)
    # qa_id 随响应返回(FR-12 反馈关联),与 QA 日志 id 一致
    assert body["qa_id"].startswith("qa-")
    assert len(body["citations"]) == 1
    citation = body["citations"][0]
    assert set(citation) == {
        "index", "doc_id", "chunk_id", "quote",
        "text", "source", "score",
        "doc_title", "doc_format", "doc_status", "doc_uploaded_at",
    }
    assert citation["doc_id"] == "doc-hr-05" and citation["chunk_id"] == "doc-hr-05-0"
    assert citation["quote"] in TEXT_HR05
    # 富字段:完整 chunk 原文 + 来源 + 展示口径分数(hybrid_rerank → rerank 分)
    assert citation["text"] == TEXT_HR05
    assert citation["source"] == "hybrid"
    assert citation["score"] == 0.83
    # 仓库无该文档 → 元信息回退 doc_id / 空串
    assert citation["doc_title"] == "doc-hr-05"
    assert citation["doc_format"] == "" and citation["doc_status"] == ""
    # QA 日志落库
    logs = repo.list_qa_logs()
    assert len(logs) == 1
    assert logs[0]["id"] == body["qa_id"]
    assert logs[0]["query"] == "年假有几天?"
    assert logs[0]["no_answer"] == 0
    assert logs[0]["mode"] == "hybrid_rerank"
    assert json.loads(logs[0]["citations_json"]) == body["citations"]


def test_ask_enriches_citation_with_document_metadata(tmp_path):
    """文档已入仓库时,引用附带 title/format/status/uploaded_at(来源抽屉元信息)。"""
    client, repo = make_client(tmp_path)
    repo.upsert_document(
        {
            "id": "doc-hr-05",
            "title": "员工手册",
            "file_type": "md",
            "status": "indexed",
            "uploaded_at": "2026-09-01T00:00:00",
            "source_path": "demo/doc-hr-05.md",
            "synthetic": 1,
        }
    )
    resp = client.post("/api/ask", json={"query": "年假有几天?", "mode": "hybrid_rerank"})
    citation = resp.json()["citations"][0]
    assert citation["doc_title"] == "员工手册"
    assert citation["doc_format"] == "md"
    assert citation["doc_status"] == "indexed"
    assert citation["doc_uploaded_at"] == "2026-09-01T00:00:00"


def test_ask_default_mode_is_hybrid_rerank(tmp_path):
    client, _ = make_client(tmp_path)
    resp = client.post("/api/ask", json={"query": "年假有几天?"})
    assert resp.status_code == 200
    assert resp.json()["mode"] == "hybrid_rerank"


def test_ask_400_blank_query(tmp_path):
    client, _ = make_client(tmp_path)
    resp = client.post("/api/ask", json={"query": "   ", "mode": "vector"})
    assert resp.status_code == 400
    assert "query" in resp.json()["detail"]


def test_ask_400_invalid_mode(tmp_path):
    client, _ = make_client(tmp_path)
    resp = client.post("/api/ask", json={"query": "问题", "mode": "keyword"})
    assert resp.status_code == 400
    assert "mode" in resp.json()["detail"]


def test_ask_empty_index_refuses(tmp_path):
    client, repo = make_client(tmp_path, hits=[])
    resp = client.post("/api/ask", json={"query": "问题", "mode": "hybrid_rerank"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["no_answer"] is True
    assert body["answer"] is None
    assert body["citations"] == []
    assert body["confidence"] == 0.0
    # 拒答也落 QA 日志
    logs = repo.list_qa_logs()
    assert len(logs) == 1 and logs[0]["no_answer"] == 1


def test_ask_llm_failure_degrades(tmp_path):
    client, _ = make_client(tmp_path, provider=BoomProvider())
    resp = client.post("/api/ask", json={"query": "年假有几天?", "mode": "hybrid_rerank"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == DEGRADE_MESSAGE
    assert body["no_answer"] is False
    assert body["citations"] == []
