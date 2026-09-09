"""检索层指标纯函数:Hit@5 / MRR(3.2.5,L1 手算用例对照)。

定义(evaluation-plan §2,已定稿冻结):
- Hit@5:期望 doc 是否出现在 top-5;冲突类 = 命中任一期望 doc;
- MRR:首个期望 doc 排名(1-based)倒数的均值;结果列表中未出现 = 0。
- 无答案类(拒绝答)不参与命中指标,由引擎层排除。
"""


def hit_at_k(ranked_doc_ids: list[str], expected_doc_ids: list[str], k: int = 5) -> int:
    """top-k 内命中任一期望 doc → 1,否则 0(冲突类命中任一即算)。"""
    expected = set(expected_doc_ids)
    return 1 if any(doc_id in expected for doc_id in ranked_doc_ids[:k]) else 0


def first_rank(ranked_doc_ids: list[str], expected_doc_ids: list[str]) -> int:
    """首个期望 doc 的 1-based 排名;未出现在结果列表 = 0。"""
    expected = set(expected_doc_ids)
    for rank, doc_id in enumerate(ranked_doc_ids, start=1):
        if doc_id in expected:
            return rank
    return 0


def reciprocal_rank(ranked_doc_ids: list[str], expected_doc_ids: list[str]) -> float:
    rank = first_rank(ranked_doc_ids, expected_doc_ids)
    return 1.0 / rank if rank else 0.0


def summarize(
    ranked_lists: list[list[str]], expected_lists: list[list[str]], k: int = 5
) -> dict:
    """批量求 Hit@k 与 MRR(ranked/expected 等长,逐例对齐)。

    返回 {"hit_at_5": {"hits", "total", "rate"}, "mrr", "per_case": [{"rank", "hit", "rr"}]}
    空输入兜底:rate=0.0、mrr=0.0(全 skipped 场景不崩)。
    """
    per_case = []
    for ranked, expected in zip(ranked_lists, expected_lists):
        rank = first_rank(ranked, expected)
        per_case.append(
            {"rank": rank, "hit": hit_at_k(ranked, expected, k), "rr": 1.0 / rank if rank else 0.0}
        )
    total = len(per_case)
    hits = sum(entry["hit"] for entry in per_case)
    mrr = sum(entry["rr"] for entry in per_case) / total if total else 0.0
    return {
        "hit_at_5": {
            "hits": hits,
            "total": total,
            "rate": round(hits / total, 4) if total else 0.0,
        },
        "mrr": round(mrr, 4),
        "per_case": per_case,
    }
