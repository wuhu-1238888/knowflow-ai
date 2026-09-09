"""RetrievalService L1 单测(FakeKeywordEmbedder + FakeReranker + 临时 LanceDB)。

FakeKeywordEmbedder:128 维字符 bag 向量 → 余弦相似度 ∝ 字符重叠,检索结果可控可断言。
"""

import pytest

from rag_service.indexing import LanceIndex
from rag_service.retrieval import RetrievalService, SearchHit
from rag_service.rrf import rrf_fuse

# 文本设计:字符重叠度拉开差距 → 向量路与全文路结果可控
DOCS = {
    "doc-a": "报销凭证需要保留原始票据和发票",
    "doc-b": "会议纪要归档规则每周执行",
    "doc-c": "请假流程需要提前两天申请",
}


class FakeKeywordEmbedder:
    """字符 bag 向量(128 维):字符集相同的文本相似度高。"""

    dim = 128

    def embed(self, texts: list[str]) -> list[list[float]]:
        out = []
        for text in texts:
            vec = [0.0] * self.dim
            for ch in text:
                vec[ord(ch) % self.dim] = 1.0
            out.append(vec)
        return out


class FakeReranker:
    """按文本是否含「优先」给分:含 → 0.99,不含 → 0.01。"""

    def rerank(self, query: str, texts: list[str]) -> list[float]:
        return [0.99 if "优先" in t else 0.01 for t in texts]


@pytest.fixture()
def service(tmp_path):
    index = LanceIndex(FakeKeywordEmbedder(), db_path=tmp_path / "lancedb")
    for doc_id, text in DOCS.items():
        index.index_document(doc_id, text)
    index.ensure_fts()
    return RetrievalService(index, FakeKeywordEmbedder(), reranker=FakeReranker())


def test_vector_mode_ranks_by_char_overlap(service):
    hits = service.search("报销票据", mode="vector", top_k=3)
    assert hits[0].doc_id == "doc-a"
    assert hits[0].source == "vector"
    assert hits[0].chunk_id == "doc-a-0"
    assert hits[0].text == DOCS["doc-a"]
    assert 0.0 <= hits[0].score <= 1.0
    assert hits[0].rerank_score is None
    assert len(hits) == 3


def test_keyword_mode_fts(service):
    hits = service.search("请假", mode="keyword", top_k=3)
    assert hits[0].doc_id == "doc-c"
    assert hits[0].source == "keyword"
    assert hits[0].score > 0  # BM25 分数


def test_hybrid_mode_rrf_hand_computed(service):
    # 手算对照:先分别跑两路拿真实排名 → rrf_fuse → 与 hybrid 输出分数逐项一致
    hits = service.search("报销请假", mode="hybrid", top_k=3)
    assert all(h.source == "hybrid" for h in hits)
    assert len(hits) == 3
    vec_rank = [h.chunk_id for h in service.search("报销请假", mode="vector", top_k=24)]
    fts_rank = [h.chunk_id for h in service.search("报销请假", mode="keyword", top_k=24)]
    expected = rrf_fuse([vec_rank, fts_rank])
    for hit in hits:
        assert hit.score == pytest.approx(round(expected[hit.chunk_id], 6), abs=1e-6)
    # 第一名分数 = 手算最高分(同分项的具体先后由引擎内部排序决定,不作断言)
    assert hits[0].score == pytest.approx(round(max(expected.values()), 6), abs=1e-6)


def test_hybrid_rerank_reorders_by_reranker(service):
    # doc-c 加「优先」标记 → FakeReranker 给高分 → 重排第一
    index = service._index
    index.index_document("doc-c", "请假流程需要提前两天申请(优先)")
    index.ensure_fts()
    hits = service.search("请假", mode="hybrid_rerank", top_k=3)
    assert hits[0].doc_id == "doc-c"
    assert hits[0].source == "hybrid"
    assert hits[0].rerank_score == pytest.approx(0.99)
    assert hits[0].score is not None
    # 重排后分数递减
    assert [h.rerank_score for h in hits] == sorted(
        [h.rerank_score for h in hits], reverse=True
    )


def test_hybrid_rerank_requires_reranker(tmp_path):
    index = LanceIndex(FakeKeywordEmbedder(), db_path=tmp_path / "lancedb2")
    index.index_document("doc-a", DOCS["doc-a"])
    service = RetrievalService(index, FakeKeywordEmbedder(), reranker=None)
    with pytest.raises(ValueError, match="reranker"):
        service.search("报销", mode="hybrid_rerank")


def test_empty_index_returns_empty(tmp_path):
    # 空表(无数据、无 FTS 索引):三模式均返回空列表,keyword 路不抛异常
    index = LanceIndex(FakeKeywordEmbedder(), db_path=tmp_path / "lancedb-empty")
    service = RetrievalService(index, FakeKeywordEmbedder(), reranker=FakeReranker())
    assert service.search("任意词", mode="vector") == []
    assert service.search("任意词", mode="keyword") == []
    assert service.search("任意词", mode="hybrid") == []
    assert service.search("任意词", mode="hybrid_rerank") == []


def test_top_k_limits_results(tmp_path):
    index = LanceIndex(FakeKeywordEmbedder(), db_path=tmp_path / "lancedb3")
    for i in range(12):
        index.index_document(f"doc-{i}", f"编号文档第{i}篇包含关键词")
    index.ensure_fts()
    service = RetrievalService(index, FakeKeywordEmbedder(), reranker=FakeReranker())
    for mode in ("vector", "keyword", "hybrid", "hybrid_rerank"):
        hits = service.search("关键词", mode=mode, top_k=8)
        assert len(hits) == 8, mode


def test_invalid_mode_rejected(service):
    with pytest.raises(ValueError, match="非法检索模式"):
        service.search("x", mode="nope")


def test_rerank_candidates_capped(tmp_path):
    """hybrid_rerank 候选 = top_k*CANDIDATE_FACTOR → reranker 输入 ≤ 24。"""
    index = LanceIndex(FakeKeywordEmbedder(), db_path=tmp_path / "lancedb4")
    for i in range(30):
        index.index_document(f"doc-{i}", f"编号文档第{i}篇包含关键词")
    index.ensure_fts()

    seen: list[int] = []

    class CountingReranker:
        def rerank(self, query, texts):
            seen.append(len(texts))
            return [0.5] * len(texts)

    service = RetrievalService(
        index, FakeKeywordEmbedder(), reranker=CountingReranker()
    )
    hits = service.search("关键词", mode="hybrid_rerank", top_k=8)
    assert len(hits) == 8
    assert all(n <= 24 for n in seen)  # 8 * 3


def test_hit_shape(service):
    hit = service.search("报销", mode="vector")[0]
    assert isinstance(hit, SearchHit)
    assert hit.chunk_id and hit.doc_id and hit.text
    assert isinstance(hit.score, float)
