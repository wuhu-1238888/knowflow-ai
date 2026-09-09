"""EvaluationEngine L1 单测:假 search_fn + 临时目录(不依赖真实模型/索引)。"""

import json

import pytest

from rag_service import eval_engine
from rag_service.db import init_db
from rag_service.eval_engine import (
    build_matrix,
    compute_params_hash,
    get_doc_commit,
    record_run,
    run_mode,
    save_matrix,
    save_run,
)
from rag_service.repository import Repository
from rag_service.retrieval import SearchHit

FIXED_CREATED_AT = "2026-09-09T08:15:30+00:00"
FIXED_HASH = "abc123def4567890"

# 迷你评测集:2 例可计量 + 1 例拒答(不参与指标)+ 1 例冲突
CASES = [
    {
        "id": "C01",
        "category": "精确关键词检索",
        "query": "年假有几天?",
        "expected_behavior": "answer",
        "expected_doc_ids": ["doc-hr-05"],
        "expected_chunk_ids": [],
        "expected_answer_points": ["年假 10 天"],
        "annotated_by": "测试",
    },
    {
        "id": "C11",
        "category": "知识库无答案",
        "query": "公司有宠物寄养福利吗?",
        "expected_behavior": "refuse",
        "expected_doc_ids": [],
        "expected_chunk_ids": [],
        "expected_answer_points": [],
        "annotated_by": "测试",
    },
    {
        "id": "C13",
        "category": "文档冲突",
        "query": "市内交通费每天报销上限是多少?",
        "expected_behavior": "conflict",
        "expected_doc_ids": ["doc-hr-03", "doc-hr-04"],
        "expected_chunk_ids": [],
        "expected_answer_points": ["100 元", "150 元"],
        "annotated_by": "测试",
    },
]


def make_hit(doc_id: str, score: float = 0.9, rerank_score: float | None = None) -> SearchHit:
    return SearchHit(
        chunk_id=f"{doc_id}-0",
        doc_id=doc_id,
        text="测试文本",
        score=score,
        source="hybrid",
        rerank_score=rerank_score,
    )


def fixed_search(query: str, mode: str) -> list[SearchHit]:
    """受控排名:C01 → doc-hr-05 排第 2;C13 → doc-hr-03 排第 4;C11 → 任意文档。"""
    by_query = {
        "年假有几天?": [make_hit("doc-a"), make_hit("doc-hr-05"), make_hit("doc-b")],
        "市内交通费每天报销上限是多少?": [
            make_hit("doc-x"),
            make_hit("doc-y"),
            make_hit("doc-z"),
            make_hit("doc-hr-03"),
            make_hit("doc-hr-04"),
        ],
        "公司有宠物寄养福利吗?": [make_hit("doc-misc")],
    }
    return by_query[query]


def run_fixed(mode="hybrid", cases=None, search_fn=None):
    return run_mode(
        mode,
        search_fn or fixed_search,
        cases if cases is not None else CASES,
        created_at=FIXED_CREATED_AT,
        doc_commit="abcd123",
        params_hash=FIXED_HASH,
        top_k=5,
    )


def test_refuse_excluded_from_metrics():
    result = run_fixed()
    entries = {e["case_id"]: e for e in result["per_case"]}
    # 拒答例仍被检索并记录分数分布(τ 校准用),但不参与命中指标
    assert entries["C11"]["in_metrics"] is False
    assert entries["C11"]["hit"] is None
    assert len(entries["C11"]["hits"]) == 1
    assert result["metrics"]["hit_at_5"]["total"] == 2  # 仅 C01 + C13
    assert result["skipped"] == 0


def test_run_mode_hand_computed_metrics():
    result = run_fixed()
    # C01:doc-hr-05 排第 2 → hit + rr 0.5;C13:doc-hr-03 排第 4 → hit + rr 0.25
    entries = {e["case_id"]: e for e in result["per_case"]}
    assert entries["C01"]["hit"] == 1
    assert entries["C01"]["rr"] == pytest.approx(0.5)
    assert entries["C01"]["rank_of_first_expected"] == 2
    assert entries["C13"]["hit"] == 1
    assert entries["C13"]["rank_of_first_expected"] == 4
    assert result["metrics"]["hit_at_5"] == {"hits": 2, "total": 2, "rate": 1.0}
    assert result["metrics"]["mrr"] == pytest.approx(round((0.5 + 0.25) / 2, 4))


def test_single_failure_records_skipped():
    def flaky_search(query: str, mode: str):
        if query == "年假有几天?":
            raise RuntimeError("模拟失败")
        return fixed_search(query, mode)

    result = run_fixed(search_fn=flaky_search)
    entries = {e["case_id"]: e for e in result["per_case"]}
    assert entries["C01"]["skipped"] is True
    assert "RuntimeError" in entries["C01"]["error"]
    # 其余用例不受影响继续评测
    assert entries["C13"]["hit"] == 1
    assert result["skipped"] == 1
    # 被跳过例不计入指标总数
    assert result["metrics"]["hit_at_5"]["total"] == 1


def test_hits_recorded_with_scores_and_sources():
    result = run_fixed(mode="hybrid_rerank")
    first = result["per_case"][0]["hits"][0]
    assert set(first) == {"chunk_id", "doc_id", "source", "score", "rerank_score"}
    assert result["per_case"][0]["hits"][1]["doc_id"] == "doc-hr-05"


def test_run_json_round_trip(tmp_path):
    result = run_fixed()
    path = save_run(result, tmp_path)
    assert path.name == "run-2026-09-09T081530Z-hybrid.json"
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded == result


def test_matrix_content_and_save(tmp_path):
    results = {mode: run_fixed(mode) for mode in ("vector", "hybrid", "hybrid_rerank")}
    text = build_matrix(results, CASES)
    for mode in ("vector", "hybrid", "hybrid_rerank"):
        assert f"| {mode} |" in text
    assert "精确关键词检索" in text
    assert "文档冲突" in text
    assert "2/2" in text and "| 0 |" in text  # 各模式 hit 数/总数为 2/2,跳过 0
    assert "知识库无答案" not in text  # 拒答类不进检索层矩阵
    path = save_matrix(results, CASES, tmp_path, FIXED_CREATED_AT)
    assert path.name == "matrix-2026-09-09T081530Z.md"


def test_record_run_into_db(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWFLOW_RUNTIME_DIR", str(tmp_path))
    init_db()
    repo = Repository()
    result = run_fixed()
    record_run(result, repo)
    row = repo.get_run(result["run_id"])
    assert row["mode"] == "hybrid"
    assert row["params_hash"] == FIXED_HASH
    assert row["doc_commit"] == "abcd123"
    assert json.loads(row["metrics_json"]) == result["metrics"]


def test_params_hash_deterministic_and_sensitive(tmp_path, monkeypatch):
    hash_a = compute_params_hash(models_dir=tmp_path)
    hash_b = compute_params_hash(models_dir=tmp_path)
    assert hash_a == hash_b
    assert len(hash_a) == 16
    # 参数变化 → 哈希变化(常量名绑定在 eval_engine 模块,直接 patch 该模块)
    monkeypatch.setattr(
        eval_engine, "CHUNK_MAX_CHARS", eval_engine.CHUNK_MAX_CHARS + 1
    )
    assert compute_params_hash(models_dir=tmp_path) != hash_a


def test_params_hash_differs_with_model_placement(tmp_path):
    # 未预置模型 → 'not-placed';伪造模型目录(仅 config.json + 权重体积)→ hash 变化
    base = compute_params_hash(models_dir=tmp_path)
    model_dir = tmp_path / "BAAI" / "bge-m3"
    model_dir.mkdir(parents=True)
    (model_dir / "config.json").write_text(
        json.dumps({"architectures": ["XLMRobertaModel"]}), encoding="utf-8"
    )
    (model_dir / "model.safetensors").write_bytes(b"x" * 100)
    assert compute_params_hash(models_dir=tmp_path) != base


def test_doc_commit_format():
    commit = get_doc_commit()
    assert len(commit) >= 7  # 仓库内应可解析;空串仅在无 git 时兜底
