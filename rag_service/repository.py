"""Repository 层:五实体的 CRUD 封装。

约定:
- 数组字段(evaluation_cases / qa_logs 相关)在库里存 JSON 字符串,进出都做序列化;
- upsert_* 幂等(INSERT OR REPLACE),add_*/create_* 遇重复 id 抛 IntegrityError;
- 时间戳由调用方传入(测试夹具用固定日期,不做日期相对锚定)。
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .db import get_connection


def new_id(prefix: str = "") -> str:
    """演示级短 id:前缀 + uuid4 hex 前 12 位(碰撞概率对本地 demo 可忽略)。"""
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    """运行时时间戳(UTC,秒级)。测试夹具不用本函数,传固定值。"""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Repository:
    def __init__(self, db_path: Path | None = None):
        self._db_path = db_path

    def _conn(self) -> sqlite3.Connection:
        return get_connection(self._db_path)

    # ── Document ──

    def upsert_document(self, doc: dict) -> None:
        """幂等写入文档元数据(固定 id 重复装载 = 覆盖)。"""
        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO documents
                  (id, title, file_type, status, uploaded_at, source_path, synthetic)
                VALUES (:id, :title, :file_type, :status, :uploaded_at, :source_path, :synthetic)
                """,
                doc,
            )

    def get_document(self, doc_id: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = ?", (doc_id,)
            ).fetchone()
        return dict(row) if row else None

    def list_documents(self, status: str | None = None) -> list[dict]:
        sql = "SELECT * FROM documents"
        params: tuple = ()
        if status is not None:
            sql += " WHERE status = ?"
            params = (status,)
        sql += " ORDER BY uploaded_at, id"
        with self._conn() as conn:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    def delete_document(self, doc_id: str) -> bool:
        """删除文档;chunks 由外键级联删除。返回是否删到行。"""
        with self._conn() as conn:
            cur = conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        return cur.rowcount > 0

    # ── Chunk ──

    def add_chunk(self, chunk: dict) -> None:
        chunk.setdefault("metadata", "{}")  # 与 schema DEFAULT 一致
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO chunks (id, doc_id, text, chunk_order, metadata)
                VALUES (:id, :doc_id, :text, :chunk_order, :metadata)
                """,
                chunk,
            )

    def add_chunks(self, chunks: list[dict]) -> None:
        for chunk in chunks:
            chunk.setdefault("metadata", "{}")
        with self._conn() as conn:
            conn.executemany(
                """
                INSERT INTO chunks (id, doc_id, text, chunk_order, metadata)
                VALUES (:id, :doc_id, :text, :chunk_order, :metadata)
                """,
                chunks,
            )

    def list_chunks(self, doc_id: str) -> list[dict]:
        """按 chunk_order 升序(保证原文顺序)。"""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM chunks WHERE doc_id = ? ORDER BY chunk_order, id",
                (doc_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def count_chunks(self, doc_id: str) -> int:
        with self._conn() as conn:
            return conn.execute(
                "SELECT COUNT(*) FROM chunks WHERE doc_id = ?", (doc_id,)
            ).fetchone()[0]

    # ── EvaluationCase ──

    def upsert_case(self, case: dict) -> None:
        case = dict(case)
        for key in ("expected_doc_ids", "expected_chunk_ids", "expected_answer_points"):
            case[key] = json.dumps(case.get(key) or [], ensure_ascii=False)
        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO evaluation_cases
                  (id, category, query, expected_behavior, expected_doc_ids,
                   expected_chunk_ids, expected_answer_points, annotated_by)
                VALUES (:id, :category, :query, :expected_behavior, :expected_doc_ids,
                        :expected_chunk_ids, :expected_answer_points, :annotated_by)
                """,
                case,
            )

    def list_cases(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM evaluation_cases ORDER BY id"
            ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            for key in ("expected_doc_ids", "expected_chunk_ids", "expected_answer_points"):
                d[key] = json.loads(d[key])
            out.append(d)
        return out

    # ── EvaluationRun ──

    def create_run(self, run: dict) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO evaluation_runs (id, mode, params_hash, doc_commit, metrics_json, created_at)
                VALUES (:id, :mode, :params_hash, :doc_commit, :metrics_json, :created_at)
                """,
                run,
            )

    def get_run(self, run_id: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM evaluation_runs WHERE id = ?", (run_id,)
            ).fetchone()
        return dict(row) if row else None

    def list_runs(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM evaluation_runs ORDER BY created_at DESC, id"
            ).fetchall()
        return [dict(r) for r in rows]

    # ── QALog ──

    def add_qa_log(self, log: dict) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO qa_logs (id, query, answer, citations_json, no_answer, mode, created_at)
                VALUES (:id, :query, :answer, :citations_json, :no_answer, :mode, :created_at)
                """,
                log,
            )

    def list_qa_logs(self, limit: int = 50) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM qa_logs ORDER BY created_at DESC, id LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]
