"""L1:建表、幂等、外键、LanceDB 目录初始化。"""

import sqlite3

import pytest

EXPECTED_TABLES = {
    "documents",
    "chunks",
    "evaluation_cases",
    "evaluation_runs",
    "qa_logs",
}


def _tables(conn):
    return {
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }


def test_init_db_creates_five_tables_and_lancedb_dir(tmp_env):
    from rag_service.db import get_connection, init_db

    db_path = init_db()
    assert db_path.exists()
    assert (tmp_env / "lancedb").is_dir()

    conn = get_connection(db_path)
    try:
        assert EXPECTED_TABLES <= _tables(conn)
    finally:
        conn.close()


def test_init_db_idempotent(tmp_env):
    from rag_service.db import init_db

    assert init_db() == init_db()


def test_foreign_keys_enforced(tmp_env):
    from rag_service.db import get_connection, init_db

    db_path = init_db()
    conn = get_connection(db_path)
    try:
        # 无 doc_id 的 chunk 应被外键拒绝
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO chunks (id, doc_id, text, chunk_order) VALUES ('c1', 'ghost', 'x', 0)"
            )
    finally:
        conn.close()


def test_status_check_constraint(tmp_env):
    from rag_service.db import get_connection, init_db

    db_path = init_db()
    conn = get_connection(db_path)
    try:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO documents (id, title, file_type, status, uploaded_at, source_path)"
                " VALUES ('d1', 't', 'md', 'weird', '2026-09-01', 'p')"
            )
    finally:
        conn.close()
