"""gen_eval(3.2.6d)L1 单测:要点预检 / 管线运行落盘 / 核对表结构与保存。

FakeService + FakeProvider 注入,不依赖真实模型;cases 用内存小样本。
"""

import json

from rag_service.answer_pipeline import AnswerPipeline, DEGRADE_MESSAGE
from rag_service.gen_eval import (
    _actual_behavior,
    build_review_table,
    point_precheck,
    run_pipeline_mode,
    save_gen_run,
    save_review_table,
)
from rag_service.llm_adapter import AnswerDraft, Citation
from rag_service.retrieval import SearchHit

CREATED = "2026-09-09T09:00:00+00:00"
ANSWER_CASE = {
    "id": "C01",
    "category": "精确关键词检索",
    "query": "年假有几天?",
    "expected_behavior": "answer",
    "expected_answer_points": ["年假 10 天", "上限 15 天"],
}
REFUSE_CASE = {
    "id": "C11",
    "category": "知识库无答案",
    "query": "公司有宠物寄养福利吗?",
    "expected_behavior": "refuse",
    "expected_answer_points": [],
}
CONFLICT_CASE = {
    "id": "C13",
    "category": "文档冲突",
    "query": "市内交通费每天报销上限是多少?",
    "expected_behavior": "conflict",
    "expected_answer_points": ["2024 版:每日上限 100 元"],
}


def hit(doc_id: str, text: str | None = None) -> SearchHit:
    """分数全在阈值之上,三模式均不拒答。"""
    return SearchHit(
        chunk_id=f"{doc_id}-0",
        doc_id=doc_id,
        text=text or f"{doc_id} 正文:年假 10 天。",
        score=0.7,
        source="hybrid",
        rerank_score=0.8,
        vec_score=0.7,
    )


class FakeService:
    """按 query 返回预设 hits;query 不在表内则抛异常(触发 skipped)。"""

    def __init__(self, hits_by_query: dict[str, list[SearchHit]]):
        self._by_query = hits_by_query

    def search(self, query: str, mode: str, top_k: int = 8):
        if query not in self._by_query:
            raise RuntimeError(f"检索炸了: {query}")
        return self._by_query[query]


class FakeProvider:
    def __init__(self, draft: AnswerDraft):
        self._draft = draft

    def generate(self, query, chunks):
        return self._draft


def valid_draft() -> AnswerDraft:
    return AnswerDraft(
        answer="年假 10 天,上限 15 天。",
        citations=[Citation(index=1, doc_id="doc-a", chunk_id="doc-a-0", quote="x")],
        conflicts=None,
    )


def run(cases, hits_by_query=None, draft=None) -> dict:
    if hits_by_query is None:
        hits_by_query = {c["query"]: [hit("doc-a")] for c in cases}
    service = FakeService(hits_by_query)
    pipeline = AnswerPipeline(FakeProvider(draft or valid_draft()))
    return run_pipeline_mode(
        "hybrid_rerank", service.search, pipeline, cases,
        CREATED, "abc1234", "hash123456789012", top_k=8,
    )


# ── 要点预检 ──

def test_point_precheck_markdown_noise_covered():
    answer = "## 年假\n- 正式员工每年享有**年假 10 天**,上限 15 天。"
    pre = point_precheck(answer, ["年假 10 天", "上限 15 天"])
    assert pre["covered"] == ["年假 10 天", "上限 15 天"]
    assert pre["missing"] == [] and pre["total"] == 2


def test_point_precheck_missing_and_none_answer():
    pre = point_precheck("别的答案。", ["年假 10 天"])
    assert pre["covered"] == [] and pre["missing"] == ["年假 10 天"]
    # 拒答(answer=None)全 missing
    pre = point_precheck(None, ["年假 10 天"])
    assert pre["covered"] == [] and pre["total"] == 1


def test_point_precheck_punctuation_and_case_tolerance():
    # 冒号/反引号/括号/大小写差异不得造成漏匹配(C02 实际形态)
    answer = "**下载地址:** `https://vpn.novatech.example.com/client`,用企业账号(NF-ID)登录。"
    pre = point_precheck(
        answer,
        ["下载地址 https://vpn.novatech.example.com/client", "用企业账号登录后选择操作系统版本"],
    )
    assert pre["covered"] == ["下载地址 https://vpn.novatech.example.com/client"]
    assert pre["missing"] == ["用企业账号登录后选择操作系统版本"]


# ── 管线运行 ──

def test_run_records_full_fields():
    result = run([ANSWER_CASE])
    assert result["run_id"].startswith("gen-")
    assert result["mode"] == "hybrid_rerank"
    assert result["provider"] == "MockProvider"
    assert result["doc_commit"] == "abc1234"
    assert result["skipped"] == 0
    entry = result["per_case"][0]
    assert entry["case_id"] == "C01"
    assert entry["no_answer"] is False
    assert entry["answer"] == "年假 10 天,上限 15 天。"
    assert entry["citations"] == [
        {
            "index": 1, "doc_id": "doc-a", "chunk_id": "doc-a-0",
            "quote": "doc-a 正文:年假 10 天。",
            "text": "doc-a 正文:年假 10 天。", "source": "hybrid", "score": 0.8,
        }
    ]
    assert entry["hits"][0]["vec_score"] == 0.7
    pre = entry["point_precheck"]
    assert pre["covered"] == ["年假 10 天", "上限 15 天"]


def test_run_records_refuse():
    result = run([REFUSE_CASE], hits_by_query={REFUSE_CASE["query"]: []})
    entry = result["per_case"][0]
    assert entry["no_answer"] is True
    assert entry["answer"] is None
    assert entry["citations"] == []
    assert _actual_behavior(entry) == "拒答"


def test_run_single_case_error_skipped():
    cases = [ANSWER_CASE, REFUSE_CASE]
    result = run(cases, hits_by_query={ANSWER_CASE["query"]: [hit("doc-a")]})
    assert result["skipped"] == 1
    assert result["per_case"][0]["skipped"] is False
    refused = result["per_case"][1]
    assert refused["skipped"] is True
    assert "检索炸了" in refused["error"]


def test_run_degrade_behavior():
    class BoomProvider(FakeProvider):
        def generate(self, query, chunks):
            raise RuntimeError("LLM 挂了")

    service = FakeService({ANSWER_CASE["query"]: [hit("doc-a")]})
    pipeline = AnswerPipeline(BoomProvider(valid_draft()))
    result = run_pipeline_mode(
        "hybrid_rerank", service.search, pipeline, [ANSWER_CASE],
        CREATED, "abc1234", "hash123456789012",
    )
    entry = result["per_case"][0]
    assert entry["answer"] == DEGRADE_MESSAGE
    assert _actual_behavior(entry) == "降级"


# ── 核对表 ──

def test_review_table_structure_and_precheck():
    result = run([ANSWER_CASE, CONFLICT_CASE])
    table = build_review_table({"hybrid_rerank": result}, [ANSWER_CASE, CONFLICT_CASE])
    assert "## 模式:hybrid_rerank" in table
    for line in ("人工:要点", "人工:幻觉", "人工:引用", "人工:拒答", "人工:冲突"):
        assert line in table
    assert "params_hash=hash123456789012" in table
    assert "MockProvider" in table
    assert "要点 2/2" in table
    assert "拒答对齐✓" in table
    # 冲突例:Mock 限制如实暴露
    assert "冲突 None(Mock 限制)" in table
    assert "C01" in table and "C13" in table
    assert "年假有几天?" in table  # 逐例输出含 query


def test_review_table_skipped_row():
    result = run([ANSWER_CASE], hits_by_query={})
    table = build_review_table({"hybrid_rerank": result}, [ANSWER_CASE])
    assert "跳过" in table and "检索炸了" in table


# ── 落盘 ──

def test_save_gen_run_filename_and_roundtrip(tmp_path):
    result = run([ANSWER_CASE])
    path = save_gen_run(result, tmp_path)
    assert path.name == "gen-2026-09-09T090000Z-hybrid_rerank.json"
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded == result
    assert loaded["per_case"][0]["answer"] == "年假 10 天,上限 15 天。"


def test_save_review_table_writes_md(tmp_path):
    result = run([ANSWER_CASE])
    table = build_review_table({"hybrid_rerank": result}, [ANSWER_CASE])
    path = save_review_table(table, tmp_path, CREATED)
    assert path.name == "review-2026-09-09T090000Z.md"
    assert path.read_text(encoding="utf-8") == table
