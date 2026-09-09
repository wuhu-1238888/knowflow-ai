"""RetrievalService:四模式检索 + RRF 融合 + Rerank。

模式:
- vector:       bge-m3 稠密向量余弦相似(top_k)
- keyword:      LanceDB 全文倒排 BM25(top_k;中文 ngram(2,3) 分词)
- hybrid:       vector + keyword 各取 top_k*CANDIDATE_FACTOR 候选 → RRF 融合取 top_k
- hybrid_rerank:hybrid 候选 → bge-reranker-v2-m3 重排取 top_k(rerank_score 附加)

常量(改动须人拍板+重跑评测):TOP_K=8、RRF_K=60(rrf.py)、CANDIDATE_FACTOR=3。
数据权限边界:仅检索本知识库 chunks 表,禁止跨索引。
空索引返回空列表(触发拒答链路)。
"""

import os
from dataclasses import dataclass
from typing import Protocol

from .config import get_models_dir
from .indexing import Embedder, LanceIndex
from .rrf import rrf_fuse

TOP_K = 8
CANDIDATE_FACTOR = 3

MODES = ("vector", "keyword", "hybrid", "hybrid_rerank")


@dataclass(frozen=True)
class SearchHit:
    chunk_id: str
    doc_id: str
    text: str
    score: float
    source: str  # vector | keyword | hybrid
    rerank_score: float | None = None


class Reranker(Protocol):
    def rerank(self, query: str, texts: list[str]) -> list[float]:
        """文本列表 → 相关分数列表(与 texts 等长,越高越相关)。"""
        ...


class BgeReranker:
    """本地 bge-reranker-v2-m3(FlagEmbedding):优先本地目录,否则 HF 自动下载。"""

    MODEL_NAME = "BAAI/bge-reranker-v2-m3"

    def __init__(self) -> None:
        os.environ.setdefault("HF_HOME", str(get_models_dir() / "huggingface"))
        from FlagEmbedding import FlagReranker  # 延迟导入:测试不依赖真实模型

        local_dir = get_models_dir() / "BAAI" / "bge-reranker-v2-m3"
        model_ref = str(local_dir) if local_dir.is_dir() else self.MODEL_NAME
        self._model = FlagReranker(model_ref, use_fp16=False)

    def rerank(self, query: str, texts: list[str]) -> list[float]:
        if not texts:
            return []
        pairs = [[query, text] for text in texts]
        scores = self._model.compute_score(pairs, normalize=True, batch_size=8)
        if not isinstance(scores, list):
            scores = [scores]
        return [float(s) for s in scores]


class RetrievalService:
    def __init__(
        self,
        index: LanceIndex,
        embedder: Embedder,
        reranker: Reranker | None = None,
    ) -> None:
        self._index = index
        self._embedder = embedder
        self._reranker = reranker

    def search(self, query: str, mode: str = "hybrid", top_k: int = TOP_K) -> list[SearchHit]:
        if mode not in MODES:
            raise ValueError(f"非法检索模式: {mode}(支持: {', '.join(MODES)})")
        if mode == "vector":
            return self._vector(query, top_k)
        if mode == "keyword":
            return self._keyword(query, top_k)
        if mode == "hybrid":
            return self._hybrid(query, top_k)
        return self._hybrid_rerank(query, top_k)

    def _table(self):
        return self._index._ensure_table()

    def _to_hit(self, row: dict, source: str, score: float, rerank_score: float | None = None) -> SearchHit:
        return SearchHit(
            chunk_id=row["chunk_id"],
            doc_id=row["doc_id"],
            text=row["text"],
            score=round(float(score), 6),
            source=source,
            rerank_score=round(float(rerank_score), 6) if rerank_score is not None else None,
        )

    def _vector(self, query: str, top_k: int) -> list[SearchHit]:
        vec = self._embedder.embed([query])[0]
        rows = (
            self._table()
            .search(vec, query_type="vector")
            .metric("cosine")
            .limit(top_k)
            .to_list()
        )
        # cosine distance → similarity:1 - distance
        return [self._to_hit(r, "vector", 1.0 - r["_distance"]) for r in rows]

    def _fts_available(self) -> bool:
        """FTS 倒排是否已建立(空索引/未建索引时 keyword 路为空,不抛异常)。"""
        return any(
            "FTS" in str(idx.index_type).upper()
            for idx in self._table().list_indices()
        )

    def _keyword(self, query: str, top_k: int) -> list[SearchHit]:
        if not self._fts_available():
            return []
        rows = self._table().search(query, query_type="fts").limit(top_k).to_list()
        return [self._to_hit(r, "keyword", r["_score"]) for r in rows]

    def _hybrid(self, query: str, top_k: int) -> list[SearchHit]:
        vec_rank, fts_rank, by_id = self._candidate_ranks(query, top_k)
        scores = rrf_fuse([vec_rank, fts_rank])
        if not scores:
            return []
        ordered = sorted(scores, key=lambda cid: (-scores[cid], vec_rank.index(cid) if cid in vec_rank else len(vec_rank)))
        return [
            self._to_hit(by_id[cid], "hybrid", scores[cid])
            for cid in ordered[:top_k]
        ]

    def _hybrid_rerank(self, query: str, top_k: int) -> list[SearchHit]:
        if self._reranker is None:
            raise ValueError("hybrid_rerank 模式需要 reranker,当前未配置")
        vec_rank, fts_rank, by_id = self._candidate_ranks(query, top_k)
        scores = rrf_fuse([vec_rank, fts_rank])
        if not scores:
            return []
        ordered = sorted(scores, key=lambda cid: -scores[cid])
        candidates = ordered[: top_k * CANDIDATE_FACTOR]
        rerank_scores = self._reranker.rerank(
            query, [by_id[cid]["text"] for cid in candidates]
        )
        combined = sorted(
            zip(candidates, rerank_scores), key=lambda pair: -pair[1]
        )
        return [
            self._to_hit(by_id[cid], "hybrid", scores[cid], rs)
            for cid, rs in combined[:top_k]
        ]

    def _candidate_ranks(self, query: str, top_k: int) -> tuple[list[str], list[str], dict]:
        """两路各取 top_k*CANDIDATE_FACTOR 候选,返回 (向量排名, 全文排名, id→行)。"""
        limit = top_k * CANDIDATE_FACTOR
        vec = self._embedder.embed([query])[0]
        vec_rows = (
            self._table()
            .search(vec, query_type="vector")
            .metric("cosine")
            .limit(limit)
            .to_list()
        )
        vec_rank = [r["chunk_id"] for r in vec_rows]
        fts_rank: list[str] = []
        fts_rows: list[dict] = []
        if self._fts_available():
            fts_rows = (
                self._table().search(query, query_type="fts").limit(limit).to_list()
            )
            fts_rank = [r["chunk_id"] for r in fts_rows]
        by_id = {r["chunk_id"]: r for r in vec_rows + fts_rows}
        return vec_rank, fts_rank, by_id
