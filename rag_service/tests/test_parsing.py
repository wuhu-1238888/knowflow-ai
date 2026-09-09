"""ParsingService L1 测试:5 格式固定夹具断言 + 边界(空/损坏/纯表格)。

夹具固定内容固定日期(生成一次后不再重新生成);真实演示文档全量可解析。
"""

from pathlib import Path

import pytest

from rag_service.parsing import (
    EmptyTextError,
    ParsingError,
    ParseResult,
    parse_file,
)

FIXTURES = Path(__file__).parent / "fixtures"
DEMO_DOCS = Path(__file__).parents[2] / "docs" / "demo-data" / "documents"

TITLE = "解析夹具测试文档"
KEY_PHRASE = "第一段关键内容阿尔法"


def _parse_fixture(name: str) -> ParseResult:
    return parse_file(name, (FIXTURES / name).read_bytes())


def test_md_fixture():
    result = _parse_fixture("sample.md")
    assert result.doc_id == "sample"
    assert result.title == TITLE
    assert KEY_PHRASE in result.text
    assert "| A1 | B1 |" in result.text  # md 表格保留管道文本流
    assert "<!--" not in result.text  # synthetic 注释剥离
    assert "```" not in result.text  # 代码围栏符剥离
    assert 'print("hello")' in result.text  # 围栏内容保留
    assert result.warnings == ()


def test_txt_fixture():
    result = _parse_fixture("sample.txt")
    assert result.title == TITLE  # 跳过 synthetic 标记行
    assert KEY_PHRASE in result.text
    assert "\n\n\n\n" not in result.text  # 连续空行压缩


def test_html_fixture():
    result = _parse_fixture("sample.html")
    assert result.title == TITLE  # 取自 <title>
    assert KEY_PHRASE in result.text
    assert "列A | 列B" in result.text  # 表格降级为文本流,无行尾残留 |
    assert "A1 | B1" in result.text
    assert "AT&T" in result.text  # HTML 实体反转
    assert "<标签>" in result.text
    assert "<!--" not in result.text
    assert "<p>" not in result.text and "</h1>" not in result.text


def test_pdf_fixture():
    result = _parse_fixture("sample.pdf")
    assert result.title == TITLE
    assert KEY_PHRASE in result.text
    assert "synthetic" in result.text  # 标注保留


def test_docx_fixture():
    result = _parse_fixture("sample.docx")
    assert result.title == TITLE  # Heading 样式优先
    assert KEY_PHRASE in result.text
    assert "A1 | B1" in result.text  # 真表格降级为文本流
    assert "synthetic" in result.text  # 标注保留


def test_docx_table_only():
    result = _parse_fixture("table-only.docx")
    assert result.title == "table-only"  # 无段落 → 标题回退 doc_id
    assert "A1 | B1" in result.text
    assert result.text.strip()


def test_empty_file_rejected():
    with pytest.raises(EmptyTextError, match="空文本"):
        _parse_fixture("empty.txt")


def test_corrupt_pdf_rejected():
    with pytest.raises(ParsingError):
        parse_file("bad.pdf", b"%PDF-1.4 broken garbage")


def test_corrupt_docx_rejected():
    with pytest.raises(ParsingError):
        parse_file("bad.docx", b"PK\x03\x04 broken garbage")


def test_unsupported_extension_rejected():
    with pytest.raises(ParsingError, match="不支持的格式"):
        parse_file("data.csv", b"a,b\n1,2\n")


def test_doc_id_comes_from_filename():
    content = (FIXTURES / "sample.md").read_bytes()
    result = parse_file("docs/demo-data/documents/请假制度.md", content)
    assert result.doc_id == "请假制度"
    assert result.title == TITLE


def test_all_demo_documents_parse():
    """真实演示文档(20 篇 md/txt/html)全部可解析且非空、有标题。"""
    for path in sorted(DEMO_DOCS.iterdir()):
        result = parse_file(path.name, path.read_bytes())
        assert result.text.strip(), path.name
        assert result.title.strip(), path.name
