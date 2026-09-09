"""RRF(Reciprocal Rank Fusion)融合:多路排名列表 → 融合分数。

score(item) = Σ_lists 1 / (k + rank),rank 从 1 起计。
k 为常量(60),改动须人拍板+重跑评测。
"""

RRF_K = 60


def rrf_fuse(ranked_lists: list[list[str]], k: int = RRF_K) -> dict[str, float]:
    """输入各路的 item 排名列表(越靠前排名越高,同路重复项只计第一次)。

    返回 {item: 融合分数},未出现的 item 不在结果中。
    """
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        seen: set[str] = set()
        for rank, item in enumerate(ranked):
            if item in seen:
                continue
            seen.add(item)
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + rank + 1)
    return scores
