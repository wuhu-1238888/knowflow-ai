"""AnswerPipeline(3.2.6):检索结果 → 拒答判定 → context 组装 → LLM 生成 → 规则侧校验。

契约(ai-design 管线):{query, chunks[]} → {answer, citations[], no_answer, confidence, conflicts}。
规则铁律(全部可判定验收,不依赖模型自觉):
- FR-06 拒答 = 模式主分数 < τ(规则阈值,不用 LLM 判定;τ 改动须人拍板);
- FR-05 引用编号与 quote 全部规则侧重建(编号=被摘用顺序,quote=chunk 首句摘录,
  必为原文子串),绝不信任模型自报来源;非本次检索 chunk 的引用直接丢弃;
- FR-07 冲突仅由 LLM 标注,规则侧只校验双方 doc 均在本次检索结果内,并列呈现不选边;
- LLM 异常 → 重试 1 次 → 仍失败返回标准降级话术;schema 校验失败 → 重试 1 次
  → 按拒答处理并留日志;
- 审计最小落点:全字段进 QA 日志(API 层落库,非本模块)。
"""

import logging
from dataclasses import dataclass

from .llm_adapter import AnswerDraft, Citation, RetrievedChunk
from .mock_provider import extract_sentence  # 通用摘句工具(规则侧 quote 摘录)
from .retrieval import SearchHit

logger = logging.getLogger(__name__)

# ── 拒答阈值(改动须人拍板;校准依据 docs/eval-results/tau-calibration.md)──
TAU_RERANK = 0.30  # hybrid_rerank:rerank_score 口径(Stage 10 拍板初值,实测校准维持)
TAU_VECTOR = 0.58  # vector / hybrid:向量余弦口径(2026-09-09 人拍板采纳,窗口 0.052 风险已披露)

CONTEXT_TOP_K = 3  # 进入 LLM 的最大 chunk 数
CONTEXT_MAX_CHARS = 4500  # token 预算约 3000(中文 1 token ≈ 1.5 字符近似)

REFUSE_MESSAGE = "抱歉,当前知识库中没有找到足够相关的答案。您可以尝试换一种问法,或先上传相关文档。"
DEGRADE_MESSAGE = "回答服务暂时不可用,请稍后重试。"

GENERATE_RETRIES = 1  # 失败后的重试次数(共 1 + 1 次尝试)

# /api/ask 允许的模式(keyword 仅作评测对照,不进问答链路)
ASK_MODES = ("vector", "hybrid", "hybrid_rerank")


def refusal_score(mode: str, hits: list[SearchHit]) -> float:
    """拒答判定的模式主分数口径:
    - vector:       top 余弦相似度;
    - hybrid:       向量路余弦最高分(RRF 分数仅表排名,无绝对语义不可阈值化);
    - hybrid_rerank:rerank_score 最高分(归一化 0–1,与无关内容分离度最大);
    空 hits → 0.0(触发拒答)。
    """
    if not hits:
        return 0.0
    if mode == "vector":
        return hits[0].score
    if mode == "hybrid":
        scores = [h.vec_score for h in hits if h.vec_score is not None]
        return max(scores) if scores else 0.0
    if mode == "hybrid_rerank":
        scores = [h.rerank_score for h in hits if h.rerank_score is not None]
        return max(scores) if scores else 0.0
    raise ValueError(f"非法检索模式: {mode}(支持: {', '.join(ASK_MODES)})")


def tau_for(mode: str) -> float:
    return TAU_RERANK if mode == "hybrid_rerank" else TAU_VECTOR


def build_context(hits: list[SearchHit]) -> list[RetrievedChunk]:
    """context 组装:top-k 截断 + 字符预算(约 3000 token)。"""
    chunks: list[RetrievedChunk] = []
    total = 0
    for hit in hits[:CONTEXT_TOP_K]:
        text = hit.text
        room = CONTEXT_MAX_CHARS - total
        if room <= 0:
            break
        if len(text) > room:
            text = text[:room]
        chunks.append(
            RetrievedChunk(
                chunk_id=hit.chunk_id, doc_id=hit.doc_id, text=text, score=hit.score
            )
        )
        total += len(text)
    return chunks


@dataclass(frozen=True)
class AnswerResult:
    """管线最终输出(与 /api/ask 响应 schema 一致)。"""

    answer: str | None
    citations: list[dict]  # [{index, doc_id, chunk_id, quote}]
    no_answer: bool
    confidence: float
    conflicts: list[dict] | None  # [{doc_a, doc_b, quote_a, quote_b}]


class AnswerPipeline:
    def __init__(self, provider) -> None:
        self._provider = provider

    def answer(self, query: str, hits: list[SearchHit], mode: str) -> AnswerResult:
        confidence = refusal_score(mode, hits)
        if not hits or confidence < tau_for(mode):
            return AnswerResult(
                answer=None, citations=[], no_answer=True,
                confidence=confidence, conflicts=None,
            )
        context = build_context(hits)
        draft, failure = self._generate(query, context)
        if failure == "exception":
            logger.warning("生成 %s 次均异常,返回降级话术(模式 %s)", GENERATE_RETRIES + 1, mode)
            return AnswerResult(
                answer=DEGRADE_MESSAGE, citations=[], no_answer=False,
                confidence=confidence, conflicts=None,
            )
        if failure == "schema":
            logger.warning("schema 校验 %s 次均失败,按拒答处理并留日志", GENERATE_RETRIES + 1)
            return AnswerResult(
                answer=None, citations=[], no_answer=True,
                confidence=confidence, conflicts=None,
            )
        return AnswerResult(
            answer=draft.answer,
            citations=self._map_citations(draft, hits),
            no_answer=False,
            confidence=confidence,
            conflicts=self._map_conflicts(draft, hits),
        )

    # ── 生成 + 重试 ──

    def _generate(self, query: str, chunks: list[RetrievedChunk]):
        """返回 (draft, failure);failure ∈ {None, 'exception', 'schema'}。"""
        failure = "schema"
        for attempt in range(GENERATE_RETRIES + 1):
            try:
                draft = self._provider.generate(query, chunks)
            except Exception as exc:  # LLM 异常 → 重试,重试耗尽 → 降级话术
                failure = "exception"
                logger.warning("第 %s 次生成异常: %s: %s", attempt + 1, type(exc).__name__, exc)
                continue
            if self._schema_ok(draft):
                return draft, None
            logger.warning("第 %s 次 schema 校验失败", attempt + 1)
        return None, failure

    @staticmethod
    def _schema_ok(draft: AnswerDraft) -> bool:
        """结构校验:字段类型 + 引用字段完整性 + 非「空回答且空引用」。"""
        if not isinstance(draft, AnswerDraft) or not isinstance(draft.answer, str):
            return False
        if not isinstance(draft.citations, list):
            return False
        for citation in draft.citations:
            if not isinstance(citation, Citation):
                return False
            if not (isinstance(citation.chunk_id, str) and citation.chunk_id):
                return False
        if draft.conflicts is not None and not isinstance(draft.conflicts, list):
            return False
        return bool(draft.answer or draft.citations)

    # ── 规则侧引用/冲突校验 ──

    @staticmethod
    def _map_citations(draft: AnswerDraft, hits: list[SearchHit]) -> list[dict]:
        """引用重建:丢弃非本次检索 chunk 的引用与重复引用;编号按被摘用顺序;
        quote 一律规则侧摘录(必为 chunk 原文子串,前端高亮可精确匹配)。"""
        by_chunk = {h.chunk_id: h for h in hits}
        out: list[dict] = []
        seen: set[str] = set()
        index = 1
        for citation in draft.citations:
            hit = by_chunk.get(citation.chunk_id)
            if hit is None or hit.chunk_id in seen:
                continue
            seen.add(hit.chunk_id)
            out.append(
                {
                    "index": index,
                    "doc_id": hit.doc_id,
                    "chunk_id": hit.chunk_id,
                    "quote": extract_sentence(hit.text),
                }
            )
            index += 1
        return out

    @staticmethod
    def _map_conflicts(draft: AnswerDraft, hits: list[SearchHit]) -> list[dict] | None:
        """冲突校验:双方 doc 必须都在本次检索结果内;quote 不能核对时替换为规则侧摘录。"""
        if not draft.conflicts:
            return None
        by_doc: dict[str, SearchHit] = {}
        for hit in hits:
            by_doc.setdefault(hit.doc_id, hit)
        out: list[dict] = []
        for conflict in draft.conflicts:
            hit_a, hit_b = by_doc.get(conflict.doc_a), by_doc.get(conflict.doc_b)
            if hit_a is None or hit_b is None or conflict.doc_a == conflict.doc_b:
                continue
            quote_a = conflict.quote_a if conflict.quote_a in hit_a.text else extract_sentence(hit_a.text)
            quote_b = conflict.quote_b if conflict.quote_b in hit_b.text else extract_sentence(hit_b.text)
            out.append(
                {
                    "doc_a": conflict.doc_a,
                    "doc_b": conflict.doc_b,
                    "quote_a": quote_a,
                    "quote_b": quote_b,
                }
            )
        return out or None
