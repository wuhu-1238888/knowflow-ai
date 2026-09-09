"""RRF L1 手算用例对照。"""

import pytest

from rag_service.rrf import rrf_fuse


def test_two_lists_hand_computed():
    # 手算:路1 [a,b,c],路2 [b,a,d],k=60
    # a = 1/61 + 1/62;b = 1/62 + 1/61;c = 1/63;d = 1/63
    scores = rrf_fuse([["a", "b", "c"], ["b", "a", "d"]])
    assert scores["a"] == pytest.approx(1 / 61 + 1 / 62)
    assert scores["b"] == pytest.approx(1 / 62 + 1 / 61)
    assert scores["a"] == pytest.approx(scores["b"])  # 两路前二互换 → 并列
    assert scores["c"] == pytest.approx(1 / 63)
    assert scores["d"] == pytest.approx(1 / 63)
    assert len(scores) == 4


def test_single_list_rank_order():
    scores = rrf_fuse([["x", "y", "z"]])
    assert scores["x"] > scores["y"] > scores["z"]


def test_empty_lists():
    assert rrf_fuse([]) == {}
    assert rrf_fuse([[], []]) == {}


def test_duplicate_within_list_counts_once():
    scores = rrf_fuse([["a", "a", "b"]])
    assert scores["a"] == pytest.approx(1 / 61)  # 第二次出现不计
    assert "b" in scores


def test_custom_k_changes_scores():
    s60 = rrf_fuse([["a"]], k=60)
    s10 = rrf_fuse([["a"]], k=10)
    assert s60["a"] == pytest.approx(1 / 61)
    assert s10["a"] == pytest.approx(1 / 11)


def test_missing_items_absent():
    scores = rrf_fuse([["a"]])
    assert "nope" not in scores
