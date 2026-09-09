"""chunker L1 单测:短文档/超长段落/标题切分/空文本/顺序字段/真实文档全量。"""

from pathlib import Path

from rag_service.chunker import CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, chunk_text
from rag_service.parsing import parse_file

DEMO_DOCS = Path(__file__).parents[2] / "docs" / "demo-data" / "documents"


def test_short_document_single_chunk():
    text = "标题段落\n\n正文一段。\n\n正文二段。"
    chunks = chunk_text(text)
    assert len(chunks) == 1
    # 块间空行在 chunk 内压缩为单换行(清洗语义不变)
    assert chunks[0].text == text.replace("\n\n", "\n")
    assert chunks[0].order == 0


def test_heading_starts_new_chunk():
    text = "## 节一\n\n内容甲。\n\n## 节二\n\n内容乙。"
    chunks = chunk_text(text)
    assert any(c.text.startswith("## 节一") for c in chunks)
    assert any(c.text.startswith("## 节二") for c in chunks)
    assert len(chunks) == 2


def test_long_block_forced_split_with_overlap():
    # 单块 2300 字符(无空行)→ 滑动窗口:1000/900 步进 → 3 块,重叠精确 100
    text = "。".join(f"句子{i}" for i in range(400))  # 约 2300 字符
    chunks = chunk_text(text)
    assert len(chunks) == 3
    for chunk in chunks:
        assert len(chunk.text) <= CHUNK_MAX_CHARS
    assert chunks[1].text[:CHUNK_OVERLAP_CHARS] == chunks[0].text[-CHUNK_OVERLAP_CHARS:]
    assert chunks[2].text[:CHUNK_OVERLAP_CHARS] == chunks[1].text[-CHUNK_OVERLAP_CHARS:]


def test_heading_then_long_block():
    text = "## 节一\n\n" + ("长内容" * 400)
    chunks = chunk_text(text)
    assert chunks[0].text.startswith("## 节一")
    assert len(chunks) >= 2  # 超长内容被强制切分


def test_empty_text_returns_empty():
    assert chunk_text("") == []
    assert chunk_text("   \n\n  ") == []


def test_orders_are_sequential():
    text = "## A\n\n" + ("句子。" * 300)
    chunks = chunk_text(text)
    assert [c.order for c in chunks] == list(range(len(chunks)))


def test_all_demo_documents_chunkable():
    """20 篇演示文档解析后全部可分块:非空、单块不超上限、顺序连续。"""
    for path in sorted(DEMO_DOCS.iterdir()):
        parsed = parse_file(path.name, path.read_bytes())
        chunks = chunk_text(parsed.text)
        assert chunks, path.name
        assert [c.order for c in chunks] == list(range(len(chunks))), path.name
        for chunk in chunks:
            assert len(chunk.text) <= CHUNK_MAX_CHARS, path.name
