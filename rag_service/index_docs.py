"""批量索引 CLI:python -m rag_service.index_docs

流程:20 篇演示文档 → parse(3.2.2)→ chunk + bge-m3 嵌入 + 幂等写 LanceDB(3.2.3)
→ 元数据库 documents.status 回写 'indexed'(保留原 title/uploaded_at 等字段)。
"""

from pathlib import Path

from .chunker import chunk_text
from .config import DEMO_DOCS_DIR
from .db import init_db
from .indexing import BgeM3Embedder, LanceIndex
from .parsing import SUPPORTED_EXTENSIONS, EmptyTextError, ParsingError, parse_file
from .repository import Repository


def index_demo_docs(docs_dir: Path | None = None) -> dict:
    """返回 {doc_id: chunk 数} 汇总。"""
    docs_dir = docs_dir or DEMO_DOCS_DIR
    init_db()
    repo = Repository()
    index = LanceIndex(BgeM3Embedder())

    summary: dict[str, int] = {}
    failures: list[str] = []
    for file_path in sorted(docs_dir.iterdir()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if file_path.name.startswith("~$"):
            continue  # Word 锁文件双保险,绝不入库
        try:
            result = parse_file(file_path.name, file_path.read_bytes())
        except EmptyTextError as exc:
            failures.append(f"{file_path.name}: {exc}")
            continue
        except ParsingError as exc:
            failures.append(f"{file_path.name}: {exc}")
            continue
        count = index.index_document(result.doc_id, result.text)
        summary[result.doc_id] = count
        # chunks 落元数据库(3.3.3:文档表格「分块数」从 SQLite 读,避免页面加载向量库);
        # 先删后插保证重跑幂等(FR-02)
        repo.delete_chunks(result.doc_id)
        repo.add_chunks(
            [
                {
                    "id": f"{result.doc_id}-{c.order}",
                    "doc_id": result.doc_id,
                    "text": c.text,
                    "chunk_order": c.order,
                    "metadata": "{}",
                }
                for c in chunk_text(result.text)
            ]
        )
        # 状态回写:indexed(其余元数据字段保留原值)
        existing = repo.get_document(result.doc_id)
        repo.upsert_document(
            {
                "id": result.doc_id,
                "title": result.title,
                "file_type": file_path.suffix.lower().lstrip("."),
                "status": "indexed",
                "uploaded_at": (existing or {}).get("uploaded_at", "1970-01-01T00:00:00+00:00"),
                "source_path": str(file_path),
                "synthetic": (existing or {}).get("synthetic", 1),
            }
        )
        print(f"{result.doc_id}: {count} chunks")

    for failure in failures:
        print(f"[FAILED] {failure}", flush=True)
    # 全部数据写入后再建倒排索引(索引先建后写不自动编入新行)
    index.ensure_fts()
    print(
        f"共 {len(summary)} 篇,{sum(summary.values())} chunks"
        + (f",{len(failures)} 篇失败" if failures else "")
    )
    return summary


if __name__ == "__main__":
    index_demo_docs()
