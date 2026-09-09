"""IndexingService L1 单测(Md5Embedder + 临时 LanceDB,零模型零网络)。

验证:写入行/字段、幂等重索引、FTS 索引建立、多文档隔离、空文本拒绝。
"""

import pytest

from rag_service.chunker import chunk_text
from rag_service.indexing import LanceIndex, Md5Embedder

TEXT_A = "## 节一\n\n段落甲一。\n\n段落甲二。"
TEXT_B = "## 节一\n\n段落乙一。\n\n段落乙二。"


@pytest.fixture()
def index(tmp_path):
    return LanceIndex(Md5Embedder(), db_path=tmp_path / "lancedb")


def test_index_document_writes_rows(index):
    count = index.index_document("doc-a", TEXT_A)
    assert count == len(chunk_text(TEXT_A))
    chunks = index.list_chunks("doc-a")
    assert len(chunks) == count
    for chunk in chunks:
        assert chunk["chunk_id"] == f"doc-a-{chunk['chunk_order']}"
        assert chunk["doc_id"] == "doc-a"
        assert len(chunk["vector"]) == Md5Embedder.dim


def test_idempotent_reindex(index):
    first = index.index_document("doc-a", TEXT_A)
    before = index.list_chunks("doc-a")
    second = index.index_document("doc-a", TEXT_A)
    after = index.list_chunks("doc-a")
    assert first == second == index.count_chunks("doc-a")
    assert [c["text"] for c in before] == [c["text"] for c in after]
    assert [c["chunk_id"] for c in before] == [c["chunk_id"] for c in after]
    # 向量逐行一致(float32 往返)
    for a, b in zip(before, after):
        assert a["vector"].tolist() == b["vector"].tolist()


def test_reindex_replaces_old_rows(index):
    index.index_document("doc-a", TEXT_A)
    count = index.index_document("doc-a", "只有一段的新内容。")
    assert index.count_chunks("doc-a") == count
    assert "新内容" in [c["text"] for c in index.list_chunks("doc-a")][0]
    assert all("段落甲" not in c["text"] for c in index.list_chunks("doc-a"))


def test_ensure_fts_idempotent(index):
    index.ensure_fts()
    index.ensure_fts()  # 已存在时跳过,不抛异常
    index_types = [str(idx.index_type).upper() for idx in index._ensure_table().list_indices()]
    assert any("FTS" in t for t in index_types)


def test_multiple_documents_isolated(index):
    index.index_document("doc-a", TEXT_A)
    index.index_document("doc-b", TEXT_B)
    assert index.list_doc_ids() == ["doc-a", "doc-b"]
    assert index.count_chunks("doc-a") + index.count_chunks("doc-b") == index.count_chunks()


def test_empty_text_writes_zero_rows(index):
    assert index.index_document("doc-empty", "   \n\n  ") == 0
    assert index.count_chunks("doc-empty") == 0
    assert index.list_chunks("doc-empty") == []


def test_doc_id_sql_injection_safe(index):
    # doc_id 含单引号不应破坏 delete 语句(转义后按字面匹配)
    index.index_document("doc'x", TEXT_A)
    assert index.count_chunks("doc'x") == len(chunk_text(TEXT_A))
    assert index.list_doc_ids() == ["doc'x"]
