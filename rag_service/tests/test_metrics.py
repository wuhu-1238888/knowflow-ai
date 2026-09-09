"""指标纯函数 L1 单测:Hit@5 / MRR 手算用例对照(FR-08 确定性函数)。"""

import pytest

from rag_service.metrics import first_rank, hit_at_k, reciprocal_rank, summarize

RANKED = ["doc-a", "doc-b", "doc-c", "doc-d", "doc-e", "doc-f"]


# ── Hit@5 手算对照(≥3 例)──

def test_hit_at_5_in_top():
    assert hit_at_k(RANKED, ["doc-c"]) == 1  # 排名 3 ≤ 5


def test_hit_at_5_outside_top():
    assert hit_at_k(RANKED, ["doc-f"]) == 0  # 排名 6 > 5


def test_hit_at_5_absent():
    assert hit_at_k(RANKED, ["doc-z"]) == 0  # 未出现


def test_hit_at_5_conflict_any_expected():
    # 冲突类:命中任一期望 doc 即算
    assert hit_at_k(RANKED, ["doc-z", "doc-b"]) == 1


def test_hit_at_5_empty():
    assert hit_at_k([], ["doc-a"]) == 0
    assert hit_at_k(RANKED, []) == 0


# ── first_rank / MRR 手算对照(≥3 例)──

def test_first_rank_basic():
    assert first_rank(RANKED, ["doc-c"]) == 3


def test_first_rank_conflict_min_rank():
    assert first_rank(RANKED, ["doc-e", "doc-b"]) == 2  # 取首个出现的


def test_first_rank_absent_is_zero():
    assert first_rank(RANKED, ["doc-z"]) == 0


def test_reciprocal_rank_values():
    assert reciprocal_rank(RANKED, ["doc-a"]) == 1.0      # rank 1
    assert reciprocal_rank(RANKED, ["doc-b"]) == pytest.approx(1 / 2)
    assert reciprocal_rank(RANKED, ["doc-f"]) == pytest.approx(1 / 6)
    assert reciprocal_rank(RANKED, ["doc-z"]) == 0.0      # 未出现 = 0


# ── summarize 批量聚合手算对照 ──

def test_summarize_hand_computed():
    ranked = [
        ["a", "b", "c", "d", "e", "f"],   # 期望 a:rank 1,hit
        ["x", "a", "b", "c", "d", "e"],   # 期望 a:rank 2,hit
        ["x", "y", "z", "w", "v", "a"],   # 期望 a:rank 6,未中
        ["x", "y", "z"],                  # 期望 a:未出现,未中
    ]
    expected = [["a"], ["a"], ["a"], ["a"]]
    out = summarize(ranked, expected)
    assert out["hit_at_5"] == {"hits": 2, "total": 4, "rate": 0.5}
    # MRR = (1 + 1/2 + 1/6 + 0) / 4
    assert out["mrr"] == pytest.approx(round((1 + 0.5 + 1 / 6 + 0) / 4, 4))
    assert out["per_case"][0] == {"rank": 1, "hit": 1, "rr": 1.0}
    assert out["per_case"][2] == {"rank": 6, "hit": 0, "rr": pytest.approx(1 / 6)}


def test_summarize_conflict_pairs():
    # 冲突类期望两个 doc:任一命中,rank 取最小
    ranked = [["a", "b", "c", "d", "e"], ["x", "y", "b", "z", "w"]]
    expected = [["b", "a"], ["b", "a"]]
    out = summarize(ranked, expected)
    assert out["hit_at_5"]["hits"] == 2
    assert out["per_case"][0]["rank"] == 1
    assert out["per_case"][1]["rank"] == 3
    assert out["mrr"] == pytest.approx(round((1 + 1 / 3) / 2, 4))


def test_summarize_empty_input():
    out = summarize([], [])
    assert out == {
        "hit_at_5": {"hits": 0, "total": 0, "rate": 0.0},
        "mrr": 0.0,
        "per_case": [],
    }
