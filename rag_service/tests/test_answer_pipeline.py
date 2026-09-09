"""AnswerPipeline L1 单测:拒答阈值边界 / 引用规则侧重建 / 重试策略 / 冲突校验。

FakeProvider 可编排(按调用次数返回预设 draft 或抛异常),不依赖真实模型。
"""

import pytest

from rag_service.answer_pipeline import (
    DEGRADE_MESSAGE,
    AnswerPipeline,
    build_context,
    refusal_score,
)
from rag_service.llm_adapter import AnswerDraft, Citation, Conflict
from rag_service.retrieval import SearchHit

TEXT_A = "年假每年 10 天,司龄每满一年增加 1 天,上限 15 天。"
TEXT_B = "年假 8 天。"
TEXT_LONG = "报销流程说明。" * 600  # 4200 字符,逼近预算


def hit(
    doc_id: str,
    score: float = 0.0328,
    text: str | None = None,
    rerank_score: float | None = 0.8,
    vec_score: float | None = 0.8,
    **extra,
) -> SearchHit:
    """默认分数均在阈值之上(hybrid_rerank τ=0.30 / hybrid·vector τ=0.58),
    阈值边界用例显式覆盖低分。"""
    return SearchHit(
        chunk_id=f"{doc_id}-0",
        doc_id=doc_id,
        text=text or f"{doc_id} 正文内容。",
        score=score,
        source="hybrid",
        rerank_score=rerank_score,
        vec_score=vec_score,
        **extra,
    )


class FakeProvider:
    """可编排 provider:调用次数由 self.calls 记录;drafts/errors 按序消费。"""

    def __init__(self, drafts=None, errors=None):
        self.drafts = list(drafts or [])
        self.errors = list(errors or [])
        self.calls = 0

    def generate(self, query, chunks):
        self.calls += 1
        if self.calls <= len(self.errors) and self.errors[self.calls - 1] is not None:
            raise self.errors[self.calls - 1]
        return self.drafts[min(self.calls, len(self.drafts)) - 1]


def valid_draft(answer="答案", chunk_id="doc-a-0") -> AnswerDraft:
    return AnswerDraft(
        answer=answer,
        citations=[Citation(index=1, doc_id="doc-a", chunk_id=chunk_id, quote="模型自报引用")],
        conflicts=None,
    )


# ── 拒答阈值边界 ──

def test_refuse_below_tau_vector():
    pipeline = AnswerPipeline(FakeProvider([valid_draft()]))
    result = pipeline.answer("问题", [hit("doc-a", score=0.57)], mode="vector")
    assert result.no_answer is True
    assert result.answer is None
    assert result.citations == []
    assert result.confidence == pytest.approx(0.57)


def test_answer_at_or_above_tau_vector():
    pipeline = AnswerPipeline(FakeProvider([valid_draft()]))
    # 阈值边界:score == τ 不算拒答(判定条件为 < τ)
    result = pipeline.answer("问题", [hit("doc-a", score=0.58)], mode="vector")
    assert result.no_answer is False
    assert result.answer == "答案"
    assert result.confidence == pytest.approx(0.58)


def test_refuse_empty_hits():
    pipeline = AnswerPipeline(FakeProvider())
    result = pipeline.answer("问题", [], mode="hybrid_rerank")
    assert result.no_answer is True
    assert result.confidence == 0.0
    assert pipeline._provider.calls == 0  # 未触发生成


def test_refuse_below_tau_rerank():
    pipeline = AnswerPipeline(FakeProvider([valid_draft()]))
    result = pipeline.answer(
        "问题", [hit("doc-a", rerank_score=0.29)], mode="hybrid_rerank"
    )
    assert result.no_answer is True


def test_answer_above_tau_rerank():
    pipeline = AnswerPipeline(FakeProvider([valid_draft()]))
    result = pipeline.answer(
        "问题", [hit("doc-a", rerank_score=0.31)], mode="hybrid_rerank"
    )
    assert result.no_answer is False


def test_hybrid_mode_uses_vec_score():
    pipeline = AnswerPipeline(FakeProvider([valid_draft()]))
    # RRF 分数高(0.0328)但向量余弦低 → 仍拒答(hydrid 口径 = vec_score)
    refused = pipeline.answer(
        "问题", [hit("doc-a", score=0.0328, vec_score=0.45)], mode="hybrid"
    )
    assert refused.no_answer is True
    answered = pipeline.answer(
        "问题", [hit("doc-a", score=0.0328, vec_score=0.65)], mode="hybrid"
    )
    assert answered.no_answer is False


def test_refusal_score_invalid_mode():
    with pytest.raises(ValueError, match="非法检索模式"):
        refusal_score("keyword", [hit("doc-a")])


# ── 引用规则侧重建 ──

def test_citation_drops_unknown_chunk_and_rebuilds_quote():
    draft = AnswerDraft(
        answer="答案",
        citations=[
            Citation(index=7, doc_id="ghost", chunk_id="ghost-0", quote="不存在的引用"),
            Citation(index=3, doc_id="doc-a", chunk_id="doc-a-0", quote="模型自报的非原文引用"),
        ],
        conflicts=None,
    )
    pipeline = AnswerPipeline(FakeProvider([draft]))
    result = pipeline.answer("问题", [hit("doc-a", text=TEXT_A)], mode="hybrid_rerank")
    assert [c["chunk_id"] for c in result.citations] == ["doc-a-0"]
    # 编号重排(1..n)+ quote 规则侧摘录(必为原文子串)
    assert result.citations[0]["index"] == 1
    assert result.citations[0]["quote"] == "年假每年 10 天,司龄每满一年增加 1 天,上限 15 天。"
    assert result.citations[0]["quote"] in TEXT_A


def test_citation_dedup_keeps_first():
    draft = AnswerDraft(
        answer="答案",
        citations=[
            Citation(index=1, doc_id="doc-a", chunk_id="doc-a-0", quote="x"),
            Citation(index=2, doc_id="doc-a", chunk_id="doc-a-0", quote="y"),
        ],
        conflicts=None,
    )
    pipeline = AnswerPipeline(FakeProvider([draft]))
    result = pipeline.answer("问题", [hit("doc-a", score=0.7)], mode="vector")
    assert len(result.citations) == 1


# ── 冲突校验 ──

def test_conflict_drops_unknown_doc_and_fixes_quote():
    draft = AnswerDraft(
        answer="答案",
        citations=[],
        conflicts=[
            Conflict(doc_a="doc-a", doc_b="ghost", quote_a="x", quote_b="y"),
            Conflict(doc_a="doc-a", doc_b="doc-b", quote_a="非原文", quote_b="非原文"),
        ],
    )
    pipeline = AnswerPipeline(FakeProvider([draft]))
    hits = [hit("doc-a", text=TEXT_A), hit("doc-b", text=TEXT_B)]
    result = pipeline.answer("问题", hits, mode="hybrid_rerank")
    assert len(result.conflicts) == 1
    conflict = result.conflicts[0]
    assert conflict["doc_a"] == "doc-a" and conflict["doc_b"] == "doc-b"
    assert conflict["quote_a"] in TEXT_A and conflict["quote_b"] in TEXT_B


def test_no_conflicts_returns_none():
    pipeline = AnswerPipeline(FakeProvider([valid_draft()]))
    result = pipeline.answer("问题", [hit("doc-a")], mode="hybrid_rerank")
    assert result.conflicts is None


# ── 重试策略:LLM 异常 → 降级;schema 失败 → 拒答 ──

def test_llm_exception_retries_then_degrades():
    provider = FakeProvider(errors=[RuntimeError("boom"), RuntimeError("boom again")])
    pipeline = AnswerPipeline(provider)
    result = pipeline.answer("问题", [hit("doc-a")], mode="hybrid_rerank")
    assert provider.calls == 2  # 首试 + 重试 1 次
    assert result.no_answer is False
    assert result.answer == DEGRADE_MESSAGE
    assert result.citations == []


def test_schema_failure_retries_then_refuses():
    bad = AnswerDraft(answer="", citations=[], conflicts=None)
    provider = FakeProvider([bad, bad])
    pipeline = AnswerPipeline(provider)
    result = pipeline.answer("问题", [hit("doc-a")], mode="hybrid_rerank")
    assert provider.calls == 2
    assert result.no_answer is True
    assert result.answer is None


def test_schema_retry_then_success():
    bad = AnswerDraft(answer="", citations=[], conflicts=None)
    provider = FakeProvider([bad, valid_draft()])
    pipeline = AnswerPipeline(provider)
    result = pipeline.answer("问题", [hit("doc-a")], mode="hybrid_rerank")
    assert provider.calls == 2
    assert result.no_answer is False
    assert result.answer == "答案"


def test_schema_invalid_citation_field_rejected():
    draft = AnswerDraft(
        answer="答案",
        citations=[{"chunk_id": "doc-a-0"}],  # 非 Citation 实例 → schema 失败
        conflicts=None,
    )
    provider = FakeProvider([draft, draft])
    pipeline = AnswerPipeline(provider)
    result = pipeline.answer("问题", [hit("doc-a")], mode="hybrid_rerank")
    assert result.no_answer is True


# ── context 组装 ──

def test_context_top_k_and_budget():
    hits = [
        hit("doc-a", text=TEXT_LONG),  # 4200 字符:占满预算大头
        hit("doc-b", text=TEXT_B),
        hit("doc-c", text=TEXT_A),
        hit("doc-d", text=TEXT_A),  # 超出 top-3,不进 context
    ]
    chunks = build_context(hits)
    assert len(chunks) == 3
    assert chunks[0].chunk_id == "doc-a-0"
    assert len(chunks[0].text) == 4200
    total = sum(len(c.text) for c in chunks)
    assert total <= 4500  # 预算内(第二块被截断)


def test_pipeline_passes_context_to_provider():
    captured: list = []

    class CapturingProvider(FakeProvider):
        def generate(self, query, chunks):
            captured.extend(chunks)
            return super().generate(query, chunks)

    pipeline = AnswerPipeline(CapturingProvider([valid_draft()]))
    hits = [hit("doc-a", text=TEXT_A), hit("doc-b", text=TEXT_B)]
    pipeline.answer("问题", hits, mode="hybrid_rerank")
    assert [c.chunk_id for c in captured] == ["doc-a-0", "doc-b-0"]
    assert captured[0].text == TEXT_A
