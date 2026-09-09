"""L1:MockProvider 确定性输出 + AnswerDraft schema + 工厂选择。"""

from rag_service.llm_adapter import AnswerDraft, Citation, RetrievedChunk, get_provider
from rag_service.mock_provider import MockProvider, extract_sentence

CHUNKS = [
    RetrievedChunk(chunk_id="c-1", doc_id="doc-hr-05", text="年假为 10 天,司龄每满一年增加 1 天,上限 15 天。申请须提前 2 个工作日。", score=0.81),
    RetrievedChunk(chunk_id="c-2", doc_id="doc-it-02", text="VPN 客户端下载地址为 https://vpn.novatech.example.com/client。", score=0.72),
]


def test_extract_sentence_takes_first_full_sentence():
    assert extract_sentence("第一句。第二句。") == "第一句。"
    assert extract_sentence("无标点首行\n第二行") == "无标点首行"
    assert extract_sentence("") == ""
    # 超长句截断到 120 字符
    long_text = "很" * 300 + "。"
    assert len(extract_sentence(long_text)) <= 120


def test_generate_is_deterministic():
    provider = MockProvider()
    assert provider.generate("年假有几天?", CHUNKS) == provider.generate("年假有几天?", CHUNKS)


def test_generate_schema_and_citation_mapping():
    draft = MockProvider().generate("年假有几天?", CHUNKS)
    # AnswerDraft 契约字段齐
    assert isinstance(draft, AnswerDraft)
    assert isinstance(draft.answer, str) and draft.answer
    assert draft.conflicts is None
    # citations:编号 1..n 按输入顺序;quote 必须是 chunk 原文子串(前端高亮可精确匹配)
    assert [c.index for c in draft.citations] == [1, 2]
    assert all(isinstance(c, Citation) for c in draft.citations)
    for c, chunk in zip(draft.citations, CHUNKS):
        assert c.doc_id == chunk.doc_id
        assert c.chunk_id == chunk.chunk_id
        assert c.quote in chunk.text
    # answer 由摘句组成
    assert draft.answer == "年假为 10 天,司龄每满一年增加 1 天,上限 15 天。\n\nVPN 客户端下载地址为 https://vpn.novatech.example.com/client。"


def test_generate_uses_at_most_three_chunks():
    chunks = [
        RetrievedChunk(chunk_id=f"c-{i}", doc_id="d", text=f"第 {i} 句内容。")
        for i in range(1, 6)
    ]
    draft = MockProvider().generate("q", chunks)
    assert len(draft.citations) == 3
    assert [c.index for c in draft.citations] == [1, 2, 3]


def test_generate_empty_chunks_returns_empty_draft():
    """空检索 → 空 draft;拒答判定与话术属于管线层(3.2.6)。"""
    draft = MockProvider().generate("公司班车时刻?", [])
    assert draft == AnswerDraft(answer="", citations=[], conflicts=None)


def test_generate_skips_chunks_without_sentence():
    chunks = [
        RetrievedChunk(chunk_id="c-1", doc_id="d", text="   \n   "),
        RetrievedChunk(chunk_id="c-2", doc_id="d", text="有效内容。"),
    ]
    draft = MockProvider().generate("q", chunks)
    assert len(draft.citations) == 1
    # 空块被跳过,编号仍从 1 起按"被摘用顺序"编排
    assert draft.citations[0].index == 1
    assert draft.citations[0].chunk_id == "c-2"


def test_get_provider_default_mock_and_env_switch(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    assert isinstance(get_provider(), MockProvider)

    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    from rag_service.deepseek_provider import DeepSeekProvider

    assert isinstance(get_provider(), DeepSeekProvider)

    monkeypatch.setenv("LLM_PROVIDER", "gpt-99")
    import pytest

    with pytest.raises(ValueError, match="未知 LLM_PROVIDER"):
        get_provider()
