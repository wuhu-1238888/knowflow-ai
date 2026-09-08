"""L1:Repository 五实体 CRUD、边界(空值/重复 id)与幂等。"""

import sqlite3

import pytest

FIXED_DOC = {
    "id": "doc-hr-05",
    "title": "NovaTech 请假制度",
    "file_type": "md",
    "status": "parsing",
    "uploaded_at": "2026-09-01T00:00:00+00:00",
    "source_path": "docs/demo-data/documents/doc-hr-05.md",
    "synthetic": 1,
}


# ── Document ──

def test_document_upsert_get_list(repo):
    repo.upsert_document(FIXED_DOC)
    got = repo.get_document("doc-hr-05")
    assert got["title"] == "NovaTech 请假制度"
    assert got["synthetic"] == 1
    assert [d["id"] for d in repo.list_documents()] == ["doc-hr-05"]


def test_document_upsert_idempotent_overwrites(repo):
    repo.upsert_document(FIXED_DOC)
    repo.upsert_document({**FIXED_DOC, "status": "indexed"})
    assert len(repo.list_documents()) == 1
    assert repo.get_document("doc-hr-05")["status"] == "indexed"


def test_document_list_filter_by_status(repo):
    repo.upsert_document(FIXED_DOC)
    repo.upsert_document({**FIXED_DOC, "id": "doc-it-01", "status": "indexed"})
    assert [d["id"] for d in repo.list_documents(status="indexed")] == ["doc-it-01"]


def test_document_missing_title_raises(repo):
    with pytest.raises(sqlite3.IntegrityError):
        repo.upsert_document({**FIXED_DOC, "id": "bad", "title": None})


def test_document_delete_cascades_chunks(repo):
    repo.upsert_document(FIXED_DOC)
    repo.add_chunk(
        {"id": "c-1", "doc_id": "doc-hr-05", "text": "年假 10 天", "chunk_order": 0}
    )
    assert repo.delete_document("doc-hr-05") is True
    assert repo.delete_document("doc-hr-05") is False  # 已删,幂等返回 False
    assert repo.count_chunks("doc-hr-05") == 0


# ── Chunk ──

def test_chunks_ordered_by_chunk_order(repo):
    repo.upsert_document(FIXED_DOC)
    repo.add_chunks(
        [
            {"id": "c-2", "doc_id": "doc-hr-05", "text": "第二段", "chunk_order": 1},
            {"id": "c-1", "doc_id": "doc-hr-05", "text": "第一段", "chunk_order": 0},
        ]
    )
    assert [c["text"] for c in repo.list_chunks("doc-hr-05")] == ["第一段", "第二段"]


def test_chunk_duplicate_id_raises(repo):
    repo.upsert_document(FIXED_DOC)
    repo.add_chunk(
        {"id": "c-1", "doc_id": "doc-hr-05", "text": "x", "chunk_order": 0}
    )
    with pytest.raises(sqlite3.IntegrityError):
        repo.add_chunk(
            {"id": "c-1", "doc_id": "doc-hr-05", "text": "y", "chunk_order": 1}
        )


# ── EvaluationCase ──

def test_case_arrays_roundtrip_json(repo):
    repo.upsert_case(
        {
            "id": "C01",
            "category": "精确关键词检索",
            "query": "年假有几天?",
            "expected_behavior": "answer",
            "expected_doc_ids": ["doc-hr-05"],
            "expected_chunk_ids": [],
            "expected_answer_points": ["年假 10 天", "上限 15 天"],
            "annotated_by": "王荟茹",
        }
    )
    case = repo.list_cases()[0]
    assert case["expected_doc_ids"] == ["doc-hr-05"]
    assert case["expected_answer_points"] == ["年假 10 天", "上限 15 天"]


def test_case_upsert_idempotent(repo):
    case = {
        "id": "C02",
        "category": "语义检索",
        "query": "q",
        "expected_behavior": "refuse",
        "expected_doc_ids": [],
        "expected_chunk_ids": [],
        "expected_answer_points": [],
        "annotated_by": "王荟茹",
    }
    repo.upsert_case(case)
    repo.upsert_case({**case, "query": "q2"})
    assert len(repo.list_cases()) == 1
    assert repo.list_cases()[0]["query"] == "q2"


# ── EvaluationRun ──

def test_run_roundtrip_and_order(repo):
    repo.create_run(
        {
            "id": "run-a",
            "mode": "hybrid_rerank",
            "params_hash": "abc123",
            "doc_commit": "47f8005",
            "metrics_json": '{"hit_at_5": 0.9}',
            "created_at": "2026-09-08T10:00:00+00:00",
        }
    )
    repo.create_run(
        {
            "id": "run-b",
            "mode": "vector",
            "params_hash": "abc123",
            "doc_commit": "47f8005",
            "metrics_json": '{"hit_at_5": 0.5}',
            "created_at": "2026-09-09T10:00:00+00:00",
        }
    )
    assert [r["id"] for r in repo.list_runs()] == ["run-b", "run-a"]  # 新的在前
    assert repo.get_run("run-a")["mode"] == "hybrid_rerank"


def test_run_duplicate_id_raises(repo):
    run = {
        "id": "run-a",
        "mode": "vector",
        "params_hash": "p",
        "doc_commit": None,
        "metrics_json": "{}",
        "created_at": "2026-09-08T10:00:00+00:00",
    }
    repo.create_run(run)
    with pytest.raises(sqlite3.IntegrityError):
        repo.create_run(run)


# ── QALog ──

def test_qa_log_roundtrip_and_limit(repo):
    for i in range(3):
        repo.add_qa_log(
            {
                "id": f"qa-{i}",
                "query": f"问题 {i}",
                "answer": "答案",
                "citations_json": '["doc-hr-05"]',
                "no_answer": 0,
                "mode": "hybrid_rerank",
                "created_at": f"2026-09-0{9 - i}T10:00:00+00:00",
            }
        )
    logs = repo.list_qa_logs(limit=2)
    assert len(logs) == 2
    assert logs[0]["id"] == "qa-0"  # 最新在前
    assert logs[0]["citations_json"] == '["doc-hr-05"]'
