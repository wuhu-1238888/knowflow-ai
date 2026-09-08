"""演示数据装载脚本:20 篇 NovaTech 虚构文档元数据 + cases.yaml 评测集 14 例。

幂等:文档 id = 文件名去扩展名,cases id = C01..C14,重复执行为覆盖装载。
用法:python -m rag_service.seed [--db PATH]
"""

import argparse
import re
import sys
from pathlib import Path

import yaml

from . import config
from .db import init_db
from .repository import Repository

# 夹具纪律:固定日期,不做日期相对锚定(CLAUDE.md 工作纪律)
SEED_UPLOADED_AT = "2026-09-01T00:00:00+00:00"

SUPPORTED_EXTENSIONS = {".md", ".txt", ".html"}

TITLE_RE = re.compile(r"<title[^>]*>([^<]+)</title>", re.IGNORECASE)

REQUIRED_CASE_FIELDS = (
    "id",
    "category",
    "query",
    "expected_behavior",
    "expected_doc_ids",
    "expected_chunk_ids",
    "expected_answer_points",
    "annotated_by",
)


def derive_title(content: str, filename: str) -> str:
    """按格式派生文档标题:md 首个 H1 → html <title> → txt 首个正文行 → 文件名兜底。"""
    lines = content.splitlines()
    # md:首行 '# ' 标题(位于 synthetic 注释之后即可,按出现顺序找)
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    # html:<title>…</title>
    m = TITLE_RE.search(content)
    if m:
        return m.group(1).strip()
    # txt:跳过 synthetic 标记与空行后的首个非空行
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("synthetic") or stripped.startswith("<!--"):
            continue
        return stripped
    return filename


def load_documents(docs_dir: Path | None = None) -> list[dict]:
    """扫描演示文档目录,产出 documents 表行(id=文件名去扩展名)。"""
    docs_dir = docs_dir or config.DEMO_DOCS_DIR
    rows = []
    for file_path in sorted(docs_dir.iterdir()):
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if file_path.name.startswith("~$"):
            continue  # Word 锁文件双保险,绝不入库
        content = file_path.read_text(encoding="utf-8")
        rows.append(
            {
                "id": file_path.stem,
                "title": derive_title(content, file_path.name),
                "file_type": file_path.suffix.lower().lstrip("."),
                "status": "parsing",
                "uploaded_at": SEED_UPLOADED_AT,
                "source_path": str(file_path),
                "synthetic": 1,
            }
        )
    return rows


def load_cases(cases_path: Path | None = None) -> list[dict]:
    """读取并校验 cases.yaml,产出 evaluation_cases 表行。"""
    cases_path = cases_path or config.CASES_PATH
    data = yaml.safe_load(cases_path.read_text(encoding="utf-8"))
    cases = data["cases"]
    for case in cases:
        missing = [f for f in REQUIRED_CASE_FIELDS if f not in case]
        if missing:
            raise ValueError(f"cases.yaml 用例 {case.get('id', '?')} 缺字段: {missing}")
        if case["expected_behavior"] not in config.EXPECTED_BEHAVIORS:
            raise ValueError(
                f"用例 {case['id']} expected_behavior 非法: {case['expected_behavior']}"
            )
    return cases


def seed(db_path: Path | None = None, docs_dir: Path | None = None,
         cases_path: Path | None = None) -> dict:
    """装载文档元数据与评测集,返回统计。重复执行幂等(覆盖)。"""
    init_db(db_path=db_path)  # 首次运行:建 runtime 目录 + 五表
    repo = Repository(db_path)
    for doc in load_documents(docs_dir):
        repo.upsert_document(doc)
    for case in load_cases(cases_path):
        repo.upsert_case(case)
    return {"documents": len(load_documents(docs_dir)),
            "cases": len(load_cases(cases_path))}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="装载 NovaTech 演示文档与评测集(幂等)")
    parser.add_argument("--db", type=Path, default=None, help="覆盖数据库路径(默认 runtime/knowflow.db)")
    args = parser.parse_args(argv)
    stats = seed(db_path=args.db)
    print(f"装载完成: 文档 {stats['documents']} 篇, 评测用例 {stats['cases']} 例")
    return 0


if __name__ == "__main__":
    sys.exit(main())
