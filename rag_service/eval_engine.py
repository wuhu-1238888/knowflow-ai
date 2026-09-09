"""EvaluationEngine(3.2.5):cases.yaml → 三模式检索 → Hit@5/MRR → run JSON 落盘 + 指标矩阵。

契约(ai-design 管线):{mode, cases[]} → {run_id, params_hash, per_case, metrics:{hit_at_5, mrr}};
单例失败不中断全量,该例记 skipped 与 error。
诚信规则(evaluation-plan §4):指标只来自实测;params_hash 冻结模型+参数,同参数重跑数值一致;
run JSON 入库 docs/eval-results/,运行态(runtime/)不入库。

用法:python -m rag_service.eval_engine [--out-dir docs/eval-results]
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Callable

from . import config
from .chunker import CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS
from .db import init_db
from .indexing import BgeM3Embedder, LanceIndex
from .metrics import first_rank, hit_at_k, summarize
from .repository import Repository, new_id, now_iso
from .retrieval import BgeReranker, RetrievalService, TOP_K, CANDIDATE_FACTOR
from .rrf import RRF_K
from .seed import load_cases

MODES = ("vector", "hybrid", "hybrid_rerank")

# 参与检索层命中指标的期望行为(无答案类排除,evaluation-plan §1)
METRIC_BEHAVIORS = ("answer", "conflict")

# 模型文件名(权重完整性代理:体积入 params_hash)
WEIGHTS_FILE = "model.safetensors"


def _model_info(name: str, models_dir: Path | None = None) -> dict | str:
    """模型目录概要(config.json 架构 + 权重体积);未预置返回 'not-placed'。"""
    model_dir = (models_dir or config.get_models_dir()) / "BAAI" / name
    if not model_dir.is_dir():
        return "not-placed"
    cfg_path = model_dir / "config.json"
    architectures: list = []
    if cfg_path.exists():
        architectures = (
            json.loads(cfg_path.read_text(encoding="utf-8")).get("architectures", [])
        )
    weights = model_dir / WEIGHTS_FILE
    return {
        "architectures": architectures,
        "weights_bytes": weights.stat().st_size if weights.exists() else 0,
    }


def compute_params_hash(models_dir: Path | None = None) -> str:
    """参数冻结哈希:分块/检索常量 + 模型(架构+权重体积)→ sha256 前 16 位。"""
    payload = {
        "chunker": {
            "chunk_max_chars": CHUNK_MAX_CHARS,
            "chunk_overlap_chars": CHUNK_OVERLAP_CHARS,
        },
        "retrieval": {
            "top_k": TOP_K,
            "candidate_factor": CANDIDATE_FACTOR,
            "rrf_k": RRF_K,
        },
        "models": {
            "embedder": _model_info("bge-m3", models_dir),
            "reranker": _model_info("bge-reranker-v2-m3", models_dir),
        },
    }
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    )
    return digest.hexdigest()[:16]


def get_doc_commit(cwd: Path | None = None) -> str:
    """文档集/评测集锁定的 git commit(短哈希);非 git 环境返回空串。"""
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=str(cwd or config.PROJECT_ROOT),
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return proc.stdout.strip() if proc.returncode == 0 else ""


def _filename_ts(created_at: str) -> str:
    """ISO 时间戳 → 文件名安全形态:2026-09-09T08:15:30+00:00 → 2026-09-09T081530Z

    注意先替换时区后缀再删冒号,否则 +00:00 会先变成 +0000 无法匹配。
    """
    return created_at.replace("+00:00", "Z").replace(":", "")


def _hit_dict(hit) -> dict:
    # vec_score:hybrid 候选在向量路的余弦分(hybrid 拒答阈值口径,3.2.6e τ 校准取数)
    return {
        "chunk_id": hit.chunk_id,
        "doc_id": hit.doc_id,
        "source": hit.source,
        "score": hit.score,
        "rerank_score": hit.rerank_score,
        "vec_score": hit.vec_score,
    }


def run_mode(
    mode: str,
    search_fn: Callable[[str, str], list],
    cases: list[dict],
    created_at: str,
    doc_commit: str,
    params_hash: str,
    top_k: int = TOP_K,
) -> dict:
    """单模式全量评测(纯计算,不落盘)。search_fn(query, mode) → SearchHit 列表。"""
    per_case = []
    for case in cases:
        in_metrics = case["expected_behavior"] in METRIC_BEHAVIORS
        entry = {
            "case_id": case["id"],
            "category": case["category"],
            "query": case["query"],
            "expected_behavior": case["expected_behavior"],
            "expected_doc_ids": case["expected_doc_ids"],
            "in_metrics": in_metrics,
            "hits": [],
            "rank_of_first_expected": None,
            "hit": None,
            "rr": None,
            "skipped": False,
            "error": None,
        }
        try:
            hits = search_fn(case["query"], mode)
        except Exception as exc:  # 单例失败不中断全量(ai-design 契约)
            entry["skipped"] = True
            entry["error"] = f"{type(exc).__name__}: {exc}"
            per_case.append(entry)
            continue
        entry["hits"] = [_hit_dict(h) for h in hits[:top_k]]
        ranked_doc_ids = [h["doc_id"] for h in entry["hits"]]
        if in_metrics:
            rank = first_rank(ranked_doc_ids, case["expected_doc_ids"])
            entry["rank_of_first_expected"] = rank
            entry["hit"] = hit_at_k(ranked_doc_ids, case["expected_doc_ids"])
            entry["rr"] = 1.0 / rank if rank else 0.0
        per_case.append(entry)

    # skipped 例无排名,排除在指标分母外(由顶层 skipped 字段单独暴露)
    metric_cases = [e for e in per_case if e["in_metrics"] and not e["skipped"]]
    metrics = summarize(
        [[h["doc_id"] for h in e["hits"]] for e in metric_cases],
        [e["expected_doc_ids"] for e in metric_cases],
    )
    return {
        "run_id": new_id("run-"),
        "mode": mode,
        "params_hash": params_hash,
        "doc_commit": doc_commit,
        "created_at": created_at,
        "top_k": top_k,
        "per_case": per_case,
        "metrics": {"hit_at_5": metrics["hit_at_5"], "mrr": metrics["mrr"]},
        "skipped": sum(1 for e in per_case if e["skipped"]),
    }


def save_run(result: dict, out_dir: Path) -> Path:
    """run JSON 落盘(evaluation-plan §3 命名:run-<timestamp>-<mode>.json)。"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"run-{_filename_ts(result['created_at'])}-{result['mode']}.json"
    path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def _metric_cases(per_case: list[dict]) -> list[dict]:
    return [e for e in per_case if e["in_metrics"]]


def build_matrix(results: dict[str, dict], cases: list[dict]) -> str:
    """mode × category 指标矩阵(markdown;数字全部来自 run 结果)。"""
    categories = []
    for case in cases:
        if case["expected_behavior"] in METRIC_BEHAVIORS:
            if case["category"] not in categories:
                categories.append(case["category"])
    lines = ["# 检索层评测矩阵", ""]
    lines.append("| 模式 | " + " | ".join(categories) + " | Hit@5 | MRR | 跳过 |")
    lines.append("| --- | " + " | ".join("---" for _ in categories) + " | --- | --- | --- |")
    for mode in MODES:
        result = results[mode]
        per_case = result["per_case"]
        cells = []
        for category in categories:
            in_cat = [
                e for e in per_case
                if e["in_metrics"] and e["category"] == category
            ]
            hits = sum(1 for e in in_cat if e["hit"])
            cells.append(f"{hits}/{len(in_cat)}")
        metrics = result["metrics"]
        lines.append(
            f"| {mode} | " + " | ".join(cells)
            + f" | {metrics['hit_at_5']['hits']}/{metrics['hit_at_5']['total']}"
            + f" | {metrics['mrr']} | {result['skipped']} |"
        )
    lines += ["", "> 数字来源:run JSON(docs/eval-results/),禁止手填;逐例明细见各 run 文件。"]
    return "\n".join(lines) + "\n"


def save_matrix(results: dict[str, dict], cases: list[dict], out_dir: Path, created_at: str) -> Path:
    path = Path(out_dir) / f"matrix-{_filename_ts(created_at)}.md"
    path.write_text(build_matrix(results, cases), encoding="utf-8")
    return path


def record_run(result: dict, repo: Repository) -> None:
    """run 摘要入库(evaluation_runs;明细以 run JSON 为权威)。"""
    repo.create_run(
        {
            "id": result["run_id"],
            "mode": result["mode"],
            "params_hash": result["params_hash"],
            "doc_commit": result["doc_commit"],
            "metrics_json": json.dumps(result["metrics"], ensure_ascii=False),
            "created_at": result["created_at"],
        }
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="三模式检索评测(Hit@5/MRR,run JSON 落盘)")
    parser.add_argument(
        "--out-dir", type=Path, default=config.PROJECT_ROOT / "docs" / "eval-results",
        help="run JSON 与矩阵输出目录(默认 docs/eval-results)",
    )
    args = parser.parse_args(argv)

    embedder = BgeM3Embedder()
    index = LanceIndex(embedder)
    service = RetrievalService(index, embedder, reranker=BgeReranker())

    def search_fn(query: str, mode: str) -> list:
        return service.search(query, mode=mode, top_k=TOP_K)

    cases = load_cases()
    created_at = now_iso()
    params_hash = compute_params_hash()
    doc_commit = get_doc_commit()
    init_db()
    repo = Repository()

    results: dict[str, dict] = {}
    for mode in MODES:
        print(f"== {mode} ==", flush=True)
        result = run_mode(mode, search_fn, cases, created_at, doc_commit, params_hash)
        path = save_run(result, args.out_dir)
        record_run(result, repo)
        results[mode] = result
        for entry in result["per_case"]:
            if entry["skipped"]:
                print(f"  {entry['case_id']} [SKIPPED] {entry['error']}", flush=True)
            elif entry["in_metrics"]:
                mark = "命中" if entry["hit"] else "未中"
                print(
                    f"  {entry['case_id']} {entry['category']} {mark}"
                    f"(首个期望 doc 排名 {entry['rank_of_first_expected'] or '-'})",
                    flush=True,
                )
        print(f"  run JSON: {path}", flush=True)

    matrix_path = save_matrix(results, cases, args.out_dir, created_at)
    print(build_matrix(results, cases))
    print(f"矩阵: {matrix_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
