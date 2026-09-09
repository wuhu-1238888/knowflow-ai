"""LLM 适配层:可插拔 Provider 接口与工厂。

契约来源:memory-bank/ai-design.md 管线组件契约(AnswerPipeline 输出 schema)。
Provider 只产出「回答草稿」AnswerDraft;no_answer / confidence 属于管线层规则
(拒答 = 检索分数阈值 τ,3.2.6 实现),不由模型决定。

Mock 先行铁律:默认 MockProvider,零 Key 跑通全链路与 L5;真实 provider(DeepSeek)
同接口插拔,Key 只从 .env 读,AI 绝不写 Key。
"""

import os
from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class RetrievedChunk:
    """检索结果块(RetrievalService 输出的单条,provider 的输入)。"""

    chunk_id: str
    doc_id: str
    text: str
    score: float = 0.0


@dataclass(frozen=True)
class Citation:
    """引用:index = 回答中引用编号(规则侧映射,绝不信任模型自报)。"""

    index: int
    doc_id: str
    chunk_id: str
    quote: str


@dataclass(frozen=True)
class Conflict:
    """冲突:仅由模型标注「两 chunk 矛盾」,规则侧校验后并列呈现,不选边。"""

    doc_a: str
    doc_b: str
    quote_a: str
    quote_b: str


@dataclass(frozen=True)
class AnswerDraft:
    """Provider 输出:回答草稿。空 answer + 空 citations = 交给管线判拒答。"""

    answer: str = ""
    citations: list[Citation] = field(default_factory=list)
    conflicts: list[Conflict] | None = None


class LLMProvider(Protocol):
    """可插拔接口:输入 query + 检索块,输出 AnswerDraft。"""

    def generate(self, query: str, chunks: list[RetrievedChunk]) -> AnswerDraft: ...


def get_provider() -> LLMProvider:
    """工厂:按环境变量 LLM_PROVIDER 选择实现,默认 mock。"""
    name = os.environ.get("LLM_PROVIDER", "mock").strip().lower()
    if name == "mock":
        from .mock_provider import MockProvider

        return MockProvider()
    if name == "deepseek":
        from .deepseek_provider import DeepSeekProvider

        return DeepSeekProvider()
    raise ValueError(
        f"未知 LLM_PROVIDER: {name!r}(支持: mock / deepseek;Key 由人写入 .env)"
    )
