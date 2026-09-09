"""评测端点 L2 直连(TestClient + 注入 fake eval_runner,不加载真实模型)。

覆盖:列表(空/摘要形态)/ POST 启动 202 + 同批三行 / 运行中 409 /
超 30 分钟 running 视为中断放行 / 明细(含 per_case)与 404 / has_per_case 标记。
"""

import json

from fastapi.testclient import TestClient

from rag_service.db import init_db
from rag_service.main import create_app
from rag_service.repository import Repository

CREATED_AT = "2026-09-10T08:00:00+00:00"
METRICS = {"hit_at_5": {"hits": 12, "total": 12}, "mrr": 0.9583}
PER_CASE = [
    {
        "case_id": "C01",
        "category": "假期制度",
        "query": "年假有几天?",
        "expected_behavior": "answer",
        "expected_doc_ids": ["doc-hr-05"],
        "in_metrics": True,
        "hits": [],
        "rank_of_first_expected": 1,
        "hit": True,
        "rr": 1.0,
        "skipped": False,
        "error": None,
    }
]

MODES = ("vector", "hybrid", "hybrid_rerank")


def make_fake_runner(status="completed"):
    """同步写入三行(模拟后台批次跑完),返回与 start_eval 同形。"""

    def runner(repo, out_dir):
        run_ids = []
        for mode in MODES:
            run_id = f"run-fake-{mode}"
            run_ids.append(run_id)
            repo.create_run(
                {
                    "id": run_id,
                    "mode": mode,
                    "params_hash": "abc123def4567890",
                    "doc_commit": "abc1234",
                    "metrics_json": json.dumps(METRICS)
                    if status == "completed"
                    else json.dumps({"error": "模拟失败"}),
                    "status": status,
                    "per_case_json": json.dumps(PER_CASE)
                    if status == "completed"
                    else None,
                    "created_at": CREATED_AT,
                }
            )
        return {"run_ids": run_ids, "created_at": CREATED_AT}

    return runner


def make_client(tmp_path, monkeypatch, runner=None):
    monkeypatch.setenv("KNOWFLOW_RUNTIME_DIR", str(tmp_path))
    init_db(db_path=tmp_path / "knowflow.db")
    repo = Repository(db_path=tmp_path / "knowflow.db")
    app = create_app(repo=repo, eval_runner=runner or make_fake_runner())
    return TestClient(app), repo


def test_list_runs_empty(tmp_path, monkeypatch):
    client, _ = make_client(tmp_path, monkeypatch)
    resp = client.get("/api/eval/runs")
    assert resp.status_code == 200
    assert resp.json() == {"runs": []}


def test_post_run_starts_batch_and_lists_summaries(tmp_path, monkeypatch):
    client, _ = make_client(tmp_path, monkeypatch)
    resp = client.post("/api/eval/run")
    assert resp.status_code == 202
    body = resp.json()
    assert set(body) == {"run_ids", "created_at"}
    assert body["created_at"] == CREATED_AT
    assert body["run_ids"] == [f"run-fake-{mode}" for mode in MODES]

    runs = client.get("/api/eval/runs").json()["runs"]
    assert len(runs) == 3
    # 同批三行 created_at 相同,前端按批聚合
    assert len({r["created_at"] for r in runs}) == 1
    for r in runs:
        assert r["status"] == "completed"
        assert r["metrics"] == METRICS
        assert r["has_per_case"] is True
        assert "per_case" not in r  # 明细不随列表返回,走 /runs/{id}


def test_post_run_conflict_when_running(tmp_path, monkeypatch):
    client, repo = make_client(tmp_path, monkeypatch)
    repo.create_run(
        {
            "id": "run-active",
            "mode": "vector",
            "params_hash": "abc123def4567890",
            "doc_commit": "",
            "metrics_json": "{}",
            "status": "running",
            # 未来时点:age 恒为负 → 必判新鲜(避免测试随真实时钟漂移)
            "created_at": "2099-01-01T00:00:00+00:00",
        }
    )
    resp = client.post("/api/eval/run")
    assert resp.status_code == 409
    assert "已有评测正在运行" in resp.json()["detail"]


def test_post_run_recovers_stale_running_rows(tmp_path, monkeypatch):
    """服务重启遗留的 running 行(>30 分钟)→ 标记 failed 后放行新批次。"""
    client, repo = make_client(tmp_path, monkeypatch)
    repo.create_run(
        {
            "id": "run-stale",
            "mode": "vector",
            "params_hash": "abc123def4567890",
            "doc_commit": "",
            "metrics_json": "{}",
            "status": "running",
            "created_at": "2026-09-09T00:00:00+00:00",  # 固定过去时点
        }
    )
    resp = client.post("/api/eval/run")
    assert resp.status_code == 202
    stale = repo.get_run("run-stale")
    assert stale["status"] == "failed"
    assert json.loads(stale["metrics_json"]) == {"error": "运行中断(超时未完成)"}


def test_get_run_detail_with_per_case(tmp_path, monkeypatch):
    client, _ = make_client(tmp_path, monkeypatch)
    client.post("/api/eval/run")
    resp = client.get("/api/eval/runs/run-fake-vector")
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == "run-fake-vector"
    assert body["per_case"] == PER_CASE
    assert body["has_per_case"] is True


def test_get_run_detail_no_per_case(tmp_path, monkeypatch):
    """历史 CLI 批次:摘要齐全但无逐例明细 → has_per_case False。"""
    client, repo = make_client(tmp_path, monkeypatch)
    repo.create_run(
        {
            "id": "run-cli",
            "mode": "vector",
            "params_hash": "abc123def4567890",
            "doc_commit": "",
            "metrics_json": json.dumps(METRICS),
            "status": "completed",
            "created_at": "2026-09-08T00:00:00+00:00",
        }
    )
    body = client.get("/api/eval/runs/run-cli").json()
    assert body["has_per_case"] is False
    assert "per_case" not in body


def test_get_run_404(tmp_path, monkeypatch):
    client, _ = make_client(tmp_path, monkeypatch)
    assert client.get("/api/eval/runs/run-ghost").status_code == 404


def test_failed_run_metrics_carry_error(tmp_path, monkeypatch):
    client, _ = make_client(tmp_path, monkeypatch, make_fake_runner(status="failed"))
    client.post("/api/eval/run")
    runs = client.get("/api/eval/runs").json()["runs"]
    assert len(runs) == 3
    for r in runs:
        assert r["status"] == "failed"
        assert r["metrics"] == {"error": "模拟失败"}
        assert r["has_per_case"] is False
