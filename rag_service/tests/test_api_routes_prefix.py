"""双前缀挂载契约(部署平台边缘网关兜底):同一组 API 同时挂在 /api/* 与 /rag/*。

用途:前后端分容器部署时,BFF 直连失败回退「同域 + /rag 前缀」经平台网关触达 FastAPI;
本地 /api/* 行为不得因双挂载而改变。用例:/api 与 /rag 同答同 schema;/health 留在 app 层。
"""

from fastapi.testclient import TestClient

from rag_service.answer_pipeline import AnswerPipeline
from rag_service.db import init_db
from rag_service.main import create_app
from rag_service.mock_provider import MockProvider
from rag_service.repository import Repository
from rag_service.retrieval import SearchHit

TEXT = "年假每年 10 天,司龄每满一年增加 1 天,上限 15 天。"


class FakeService:
    def search(self, query: str, mode: str, top_k: int = 8):
        return [
            SearchHit(
                chunk_id="doc-hr-05-0",
                doc_id="doc-hr-05",
                text=TEXT,
                score=0.0328,
                source="hybrid",
                rerank_score=0.83,
                vec_score=0.71,
            )
        ]


def make_client(tmp_path) -> TestClient:
    init_db(db_path=tmp_path / "knowflow.db")
    return TestClient(
        create_app(
            service=FakeService(),
            pipeline=AnswerPipeline(MockProvider()),
            repo=Repository(db_path=tmp_path / "knowflow.db"),
        )
    )


def test_health_stays_on_app_root(tmp_path):
    client = make_client(tmp_path)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "service": "knowflow-rag"}


def test_rag_prefix_ask_mirrors_api_ask(tmp_path):
    client = make_client(tmp_path)
    body = {"query": "年假有几天?", "mode": "hybrid_rerank"}
    api_resp = client.post("/api/ask", json=body)
    rag_resp = client.post("/rag/ask", json=body)
    assert api_resp.status_code == 200 and rag_resp.status_code == 200
    api_body, rag_body = api_resp.json(), rag_resp.json()
    assert api_body["answer"] == rag_body["answer"] == TEXT
    assert api_body["no_answer"] is False and rag_body["no_answer"] is False
    assert api_body["citations"] == rag_body["citations"]


def test_rag_prefix_documents_list(tmp_path):
    client = make_client(tmp_path)
    resp = client.get("/rag/documents?page=1&page_size=100")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"items": [], "total": 0, "page": 1, "page_size": 100}


def test_api_prefix_still_works_after_dual_mount(tmp_path):
    client = make_client(tmp_path)
    resp = client.post("/api/ask", json={"query": "年假有几天?"})
    assert resp.status_code == 200
    assert resp.json()["mode"] == "hybrid_rerank"
