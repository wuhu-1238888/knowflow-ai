"""SQLite 元数据库:建表与连接。

六实体(Document/Chunk/EvaluationCase/EvaluationRun/QALog/QAFeedback)字段照
memory-bank/technical-design.md 数据模型;**不建**租户/角色字段。
向量与倒排索引由 LanceDB 管理,不建独立表(仅初始化 runtime/lancedb 目录)。
"""

import sqlite3
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'parsing'
    CHECK (status IN ('parsing', 'indexed', 'failed')),
  uploaded_at TEXT NOT NULL,
  source_path TEXT NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  chunk_order INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);

CREATE TABLE IF NOT EXISTS evaluation_cases (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  query TEXT NOT NULL,
  expected_behavior TEXT NOT NULL
    CHECK (expected_behavior IN ('answer', 'refuse', 'conflict')),
  expected_doc_ids TEXT NOT NULL,
  expected_chunk_ids TEXT NOT NULL DEFAULT '[]',
  expected_answer_points TEXT NOT NULL,
  annotated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  doc_commit TEXT,
  metrics_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),
  per_case_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_logs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  answer TEXT,
  citations_json TEXT NOT NULL DEFAULT '[]',
  no_answer INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_feedback (
  qa_id TEXT PRIMARY KEY,
  rating TEXT NOT NULL
    CHECK (rating IN ('useful', 'useless')),
  created_at TEXT NOT NULL
);
"""


def _migrate(conn: sqlite3.Connection) -> None:
    """轻量迁移:老库 evaluation_runs 补 status/per_case_json 列(3.3.4 评测页)。

    CREATE TABLE IF NOT EXISTS 不会改已有表,列缺失时用 ALTER 补上;
    历史 CLI 批次(status 缺省 completed / per_case 为空)语义不受影响。
    """
    cols = {row[1] for row in conn.execute("PRAGMA table_info(evaluation_runs)")}
    if "status" not in cols:
        conn.execute(
            "ALTER TABLE evaluation_runs "
            "ADD COLUMN status TEXT NOT NULL DEFAULT 'completed' "
            "CHECK (status IN ('running', 'completed', 'failed'))"
        )
    if "per_case_json" not in cols:
        conn.execute(
            "ALTER TABLE evaluation_runs ADD COLUMN per_case_json TEXT"
        )


def init_db(db_path: Path | None = None, lancedb_dir: Path | None = None) -> Path:
    """初始化元数据库与 LanceDB 目录,返回实际 db 路径。

    幂等:表用 IF NOT EXISTS;LanceDB 目录仅创建(向量写入在任务 3.2.3)。
    """
    db_path = db_path or config.get_db_path()
    lancedb_dir = lancedb_dir or config.get_lancedb_dir()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    lancedb_dir.mkdir(parents=True, exist_ok=True)
    conn = get_connection(db_path)
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        conn.commit()
    finally:
        conn.close()
    return db_path


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """打开连接:Row 工厂 + 外键约束开。调用方负责 close。"""
    conn = sqlite3.connect(str(db_path or config.get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
