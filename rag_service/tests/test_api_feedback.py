"""POST /api/qa/{qa_id}/feedback L2 直连(FR-12:有用/无用反馈,upsert 落库)。

四类用例:成功落库 / 重复提交覆盖 / QA 不存在 404 / 非法 rating 422。
"""

from fastapi.testclient import TestClient

from rag_service.db import init_db
from rag_service.main import create_app
from rag_service.repository import Repository, now_iso


def make_client(tmp_path, repo=None):
    init_db(db_path=tmp_path / "knowflow.db")
    repo = repo or Repository(db_path=tmp_path / "knowflow.db")
    return TestClient(create_app(repo=repo)), repo


def test_feedback_success_and_upsert(tmp_path):
    client, repo = make_client(tmp_path)
    repo.add_qa_log(
        {
            "id": "qa-test-1",
            "query": "问题",
            "answer": "答案",
            "citations_json": "[]",
            "no_answer": 0,
            "mode": "hybrid_rerank",
            "created_at": now_iso(),
        }
    )
    resp = client.post(
        "/api/qa/qa-test-1/feedback", json={"rating": "useful"}
    )
    assert resp.status_code == 200
    assert resp.json() == {"qa_id": "qa-test-1", "rating": "useful"}
    assert repo.get_feedback("qa-test-1") == "useful"
    # 重复提交 = 覆盖(同一 QA 只保留最新一条)
    resp = client.post(
        "/api/qa/qa-test-1/feedback", json={"rating": "useless"}
    )
    assert resp.status_code == 200
    assert repo.get_feedback("qa-test-1") == "useless"


def test_feedback_404_unknown_qa(tmp_path):
    client, _ = make_client(tmp_path)
    resp = client.post(
        "/api/qa/qa-ghost/feedback", json={"rating": "useful"}
    )
    assert resp.status_code == 404
    assert "QA 记录不存在" in resp.json()["detail"]


def test_feedback_422_invalid_rating(tmp_path):
    client, repo = make_client(tmp_path)
    repo.add_qa_log(
        {
            "id": "qa-test-2",
            "query": "问题",
            "answer": "答案",
            "citations_json": "[]",
            "no_answer": 0,
            "mode": "hybrid_rerank",
            "created_at": now_iso(),
        }
    )
    resp = client.post(
        "/api/qa/qa-test-2/feedback", json={"rating": "meh"}
    )
    assert resp.status_code == 422
