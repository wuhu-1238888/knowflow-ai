"""GenerationEval(3.2.6d):14 例全链路(真实检索 + provider 生成)→ 人工核对表。

契约(evaluation-plan §2/§3):三模式分别跑 14 例全链路 → 人工核对表
(要点 / 幻觉 / 引用 / 拒答 / 冲突五线)记录在案;人工判定为金标准,
机器只做预检(要点子串命中 / 拒答行为对齐),不替代人工。

诚实声明(写死):
- MockProvider 摘句生成 → 幻觉线为结构保证(逐字摘录),非真实生成检验;
- MockProvider conflicts 恒为 None → 冲突线 2 例注定不达标;
  以上两线真实验收 = 真实 provider 重跑(遗留 #1 范围)。

用法:python -m rag_service.gen_eval [--out-dir docs/eval-results]
"""

import argparse
import json
import sys
from pathlib import Path

from . import config
from .answer_pipeline import ASK_MODES, AnswerPipeline, DEGRADE_MESSAGE
from .eval_engine import _filename_ts, compute_params_hash, get_doc_commit
from .indexing import BgeM3Embedder, LanceIndex
from .mock_provider import MockProvider
from .repository import new_id, now_iso
from .retrieval import BgeReranker, RetrievalService, TOP_K
from .seed import load_cases

MODES = ASK_MODES  # ("vector", "hybrid", "hybrid_rerank")——与问答链路一致

# 人工核对表五线列名(evaluation-plan §2 生成层)
REVIEW_LINES = ("要点", "幻觉", "引用", "拒答", "冲突")


def _normalize(text: str) -> str:
    """要点子串匹配的宽松归一:仅保留字母/数字/中文并小写化。

    目的:消除 markdown 符号(*`#)、中英标点(冒号/括号/顿号)与大小写差异
    造成的漏匹配(机器预检,必要不充分;人工核对为金标准)。
    """
    return "".join(ch for ch in text.lower() if ch.isalnum())


def point_precheck(answer: str | None, points: list[str]) -> dict:
    """要点机器预检:归一化子串命中(必要不充分;人工核对为准)。"""
    covered, missing = [], []
    text = _normalize(answer or "")
    for point in points:
        (covered if _normalize(point) in text else missing).append(point)
    return {"covered": covered, "missing": missing, "total": len(points)}


def _hit_dict(hit) -> dict:
    return {
        "chunk_id": hit.chunk_id,
        "doc_id": hit.doc_id,
        "source": hit.source,
        "score": hit.score,
        "rerank_score": hit.rerank_score,
        "vec_score": hit.vec_score,
    }


def run_pipeline_mode(
    mode: str,
    search_fn,
    pipeline: AnswerPipeline,
    cases: list[dict],
    created_at: str,
    doc_commit: str,
    params_hash: str,
    top_k: int = TOP_K,
) -> dict:
    """单模式 14 例全链路(纯计算,不落盘):检索 → 管线 → 机器预检。"""
    per_case = []
    for case in cases:
        entry = {
            "case_id": case["id"],
            "category": case["category"],
            "query": case["query"],
            "expected_behavior": case["expected_behavior"],
            "expected_answer_points": case["expected_answer_points"],
            "no_answer": None,
            "answer": None,
            "confidence": None,
            "citations": [],
            "conflicts": None,
            "hits": [],
            "point_precheck": None,
            "skipped": False,
            "error": None,
        }
        try:
            hits = search_fn(case["query"], mode)
            result = pipeline.answer(case["query"], hits, mode)
        except Exception as exc:  # 单例失败不中断全量(ai-design 契约)
            entry["skipped"] = True
            entry["error"] = f"{type(exc).__name__}: {exc}"
            per_case.append(entry)
            continue
        entry["hits"] = [_hit_dict(h) for h in hits[:top_k]]
        entry["no_answer"] = result.no_answer
        entry["answer"] = result.answer
        entry["confidence"] = result.confidence
        entry["citations"] = result.citations
        entry["conflicts"] = result.conflicts
        entry["point_precheck"] = point_precheck(
            result.answer, case["expected_answer_points"]
        )
        per_case.append(entry)
    return {
        "run_id": new_id("gen-"),
        "mode": mode,
        "provider": "MockProvider",
        "params_hash": params_hash,
        "doc_commit": doc_commit,
        "created_at": created_at,
        "top_k": top_k,
        "per_case": per_case,
        "skipped": sum(1 for e in per_case if e["skipped"]),
    }


def _actual_behavior(entry: dict) -> str:
    if entry["no_answer"]:
        return "拒答"
    if entry["answer"] == DEGRADE_MESSAGE:
        return "降级"
    return "回答"


def _precheck_cell(entry: dict) -> str:
    """机器预检摘要(结构事实,非人工判定)。"""
    pre = entry["point_precheck"] or {}
    parts = [f"要点 {len(pre.get('covered', []))}/{pre.get('total', 0)}"]
    if entry["no_answer"]:
        ok = entry["expected_behavior"] == "refuse"
        parts.append(f"拒答对齐{'✓' if ok else '✗'}")
    else:
        parts.append(f"拒答对齐{'✓' if entry['expected_behavior'] != 'refuse' else '✗'}")
        parts.append(f"引用 {len(entry['citations'])} 条结构✓")
    if entry["conflicts"]:
        parts.append(f"冲突 {len(entry['conflicts'])} 对")
    elif entry["expected_behavior"] == "conflict":
        parts.append("冲突 None(Mock 限制)")
    return ";".join(parts)


def _detail_block(entry: dict) -> str:
    lines = [f"<details>", f"<summary>{entry['case_id']} {entry['query']}</summary>", ""]
    if entry["answer"] is not None:
        lines += [f"**答案**({entry['confidence']}):", "", "```", entry["answer"], "```"]
    citations = entry["citations"]
    lines.append(f"**引用**: {len(citations)} 条")
    for citation in citations:
        lines.append(
            f"- [{citation['index']}] {citation['doc_id']} / {citation['chunk_id']}:"
            f"「{citation['quote'][:60]}」"
        )
    conflicts = entry["conflicts"]
    lines.append(f"**冲突**: {'None' if not conflicts else ''}")
    for conflict in conflicts or []:
        lines.append(
            f"- {conflict['doc_a']}「{conflict['quote_a'][:40]}」× "
            f"{conflict['doc_b']}「{conflict['quote_b'][:40]}」"
        )
    if entry["hits"]:
        top = " · ".join(
            f"{h['chunk_id']}({h.get('rerank_score') or h['score']:.3f})"
            for h in entry["hits"][:3]
        )
        lines.append(f"**Top 命中**: {top}")
    lines += ["", "</details>", ""]
    return "\n".join(lines)


def build_review_table(results: dict[str, dict], cases: list[dict]) -> str:
    """人工核对表 markdown:每模式一张核对表 + 逐例输出(五线人工填)。"""
    header = [
        "# L5 生成层人工核对表(3.2.6d)",
        "",
        "- 参数冻结:params_hash={} / doc_commit={} / created_at={}".format(
            next(iter(results.values()))["params_hash"],
            next(iter(results.values()))["doc_commit"],
            next(iter(results.values()))["created_at"],
        ),
        "- Provider:**MockProvider**(确定性摘句);真实 provider 重跑 = 遗留 #1 范围",
        "- 口径:人工判定为金标准,机器预检仅辅助;核对重点 = **hybrid_rerank** 表",
        "  (vector / hybrid 为对照记录);五线填写 ✓ / ✗ / —(不适用)",
        "- 达标线(evaluation-plan §2):要点 ≥90% / 幻觉 0 例 / 引用错误=失败例 /"
        " 拒答 2/2 且 0 误拒 / 冲突 2/2",
        "- 诚实声明:幻觉线 = 摘句结构保证,非真实生成检验;冲突线 Mock 恒 None,"
        " 2 例必 ✗——均归遗留 #1 真实 provider 重跑",
        "",
    ]
    lines = list(header)
    verdict_cols = " | ".join(f"人工:{line}" for line in REVIEW_LINES)
    for mode, result in results.items():
        focus = "**(核对重点)**" if mode == "hybrid_rerank" else ""
        lines += [f"## 模式:{mode} {focus}", "", "### 核对表", ""]
        lines.append(
            "| 用例 | 类别 | 期望 | 实际 | 机器预检 | " + verdict_cols + " |"
        )
        lines.append(
            "| --- | --- | --- | --- | --- | " + " | ".join("---" for _ in REVIEW_LINES) + " |"
        )
        for entry in result["per_case"]:
            if entry["skipped"]:
                lines.append(
                    f"| {entry['case_id']} | {entry['category']} | "
                    f"{entry['expected_behavior']} | 跳过({entry['error']}) | | | | | | |"
                )
                continue
            lines.append(
                f"| {entry['case_id']} | {entry['category']} | "
                f"{entry['expected_behavior']} | {_actual_behavior(entry)} | "
                f"{_precheck_cell(entry)} | | | | | |"
            )
        lines += ["", "### 逐例输出", ""]
        for entry in result["per_case"]:
            if not entry["skipped"]:
                lines.append(_detail_block(entry))
        lines.append("---")
        lines.append("")
    return "\n".join(lines) + "\n"


def save_gen_run(result: dict, out_dir: Path) -> Path:
    """生成层 run JSON 落盘:gen-<timestamp>-<mode>.json。"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"gen-{_filename_ts(result['created_at'])}-{result['mode']}.json"
    path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def save_review_table(text: str, out_dir: Path, created_at: str) -> Path:
    path = Path(out_dir) / f"review-{_filename_ts(created_at)}.md"
    path.write_text(text, encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="L5 生成层 14 例全链路(人工核对表)")
    parser.add_argument(
        "--out-dir", type=Path, default=config.PROJECT_ROOT / "docs" / "eval-results",
        help="gen run JSON 与核对表输出目录(默认 docs/eval-results)",
    )
    args = parser.parse_args(argv)

    embedder = BgeM3Embedder()
    index = LanceIndex(embedder)
    service = RetrievalService(index, embedder, reranker=BgeReranker())
    pipeline = AnswerPipeline(MockProvider())

    def search_fn(query: str, mode: str) -> list:
        return service.search(query, mode=mode, top_k=TOP_K)

    cases = load_cases()
    created_at = now_iso()
    params_hash = compute_params_hash()
    doc_commit = get_doc_commit()

    results: dict[str, dict] = {}
    for mode in MODES:
        print(f"== {mode} ==", flush=True)
        result = run_pipeline_mode(
            mode, search_fn, pipeline, cases, created_at, doc_commit, params_hash
        )
        path = save_gen_run(result, args.out_dir)
        results[mode] = result
        for entry in result["per_case"]:
            if entry["skipped"]:
                print(f"  {entry['case_id']} [SKIPPED] {entry['error']}", flush=True)
            else:
                pre = entry["point_precheck"]
                print(
                    f"  {entry['case_id']} {_actual_behavior(entry)}"
                    f"(要点 {len(pre['covered'])}/{pre['total']},引用 {len(entry['citations'])})",
                    flush=True,
                )
        print(f"  gen JSON: {path}", flush=True)

    table = build_review_table(results, cases)
    table_path = save_review_table(table, args.out_dir, created_at)
    print(table)
    print(f"核对表: {table_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
