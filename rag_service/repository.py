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
        """幂等写入文档元数据(固定 id 重复装载 = 覆盖)。

        用 ON CONFLICT DO UPDATE 而非 INSERT OR REPLACE:后者内部先删父行再插入,
        在 foreign_keys=ON 下触发 chunks 级联删除(状态回写会清空已写 chunks)。
        """
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO documents
                  (id, title, file_type, status, uploaded_at, source_path, synthetic)
                VALUES (:id, :title, :file_type, :status, :uploaded_at, :source_path, :synthetic)
                ON CONFLICT(id) DO UPDATE SET
                  title = excluded.title,
                  file_type = excluded.file_type,
                  status = excluded.status,
                  uploaded_at = excluded.uploaded_at,
                  source_path = excluded.source_path,
                  synthetic = excluded.synthetic
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

    def delete_chunks(self, doc_id: str) -> None:
        """删除文档全部 chunk 行(重建索引前调用,保证幂等不重复)。"""
        with self._conn() as conn:
            conn.execute("DELETE FROM chunks WHERE doc_id = ?", (doc_id,))

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

    # ── QAFeedback(FR-12:有用/无用,记录并落库) ──

    def qa_exists(self, qa_id: str) -> bool:
        with self._conn() as conn:
            return (
                conn.execute("SELECT 1 FROM qa_logs WHERE id = ?", (qa_id,)).fetchone()
                is not None
            )

    def set_feedback(self, qa_id: str, rating: str, created_at: str) -> None:
        """反馈 upsert:同一 QA 重复提交 = 覆盖(INSERT OR REPLACE,幂等)。"""
        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO qa_feedback (qa_id, rating, created_at)
                VALUES (:qa_id, :rating, :created_at)
                """,
                {"qa_id": qa_id, "rating": rating, "created_at": created_at},
            )

    def get_feedback(self, qa_id: str) -> str | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT rating FROM qa_feedback WHERE qa_id = ?", (qa_id,)
            ).fetchone()
        return row[0] if row else None
