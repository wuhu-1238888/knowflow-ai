"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconGauge, IconPlay } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatEvalTime } from "@/lib/format";
import { getEvalRun, listEvalRuns, startEvalRun } from "@/lib/rag";
import type {
  EvalCaseDetail,
  EvalMetrics,
  EvalRunDetail,
  EvalRunStatus,
  EvalRunSummary,
} from "@/lib/rag";

/* 评测页(3.3.4 全量):动态评测矩阵 + 运行评测 + 运行历史 + per-case 明细。
 * 矩阵行 = 最新完成批次的三模式,列 = 7 类场景 + Hit@5 + MRR;数字全部来自
 * /api/eval/runs 返回的 run 结果,禁止虚构;未纳入评测引擎的指标显式「暂无数据」。
 * 运行中:矩阵区骨架脉动 + 按钮禁用 + 每 5 秒轮询,完成后自动呈现结果。
 * 本页唯一 primary = 「运行评测」;展开/收起用整行 ghost 语义的裸按钮。
 * 选型叙事保持静态(回答「为什么默认 Hybrid + Rerank」)。 */

const NO_DATA = "暂无数据";

const MODE_LABELS: Record<string, string> = {
  vector: "向量搜索(Vector)",
  hybrid: "混合搜索(Hybrid)",
  hybrid_rerank: "混合+重排(Hybrid + Rerank)",
};

const MODE_ORDER = ["vector", "hybrid", "hybrid_rerank"];

const BEHAVIOR_LABELS: Record<string, string> = {
  answer: "应作答",
  refuse: "应拒答",
  conflict: "应指出冲突",
};

function metricsOf(run: EvalRunSummary): EvalMetrics | null {
  const metrics = run.metrics as EvalMetrics;
  return metrics &&
    typeof metrics.hit_at_5 === "object" &&
    typeof metrics.mrr === "number"
    ? metrics
    : null;
}

function runError(run: EvalRunSummary): string {
  return (run.metrics as { error?: string }).error ?? "";
}

function StatusBadge({ status }: { status: EvalRunStatus }) {
  if (status === "running") {
    return <Badge variant="info">运行中</Badge>;
  }
  if (status === "completed") {
    return <Badge variant="success">已完成</Badge>;
  }
  return <Badge variant="danger">失败</Badge>;
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-4 py-3" aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="mb-2 h-10 animate-skeleton rounded-md bg-surface-2 last:mb-0"
        />
      ))}
    </div>
  );
}

/* 矩阵表:行 = 批次内已完成模式;场景列来自逐例明细,缺失的行单元格回退 "—"。 */
function MatrixTable({
  rows,
  categories,
  details,
}: {
  rows: EvalRunSummary[];
  categories: string[];
  details: Record<string, EvalRunDetail | null>;
}) {
  return (
    <div className="overflow-x-auto px-4 py-3">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-2 text-caption font-medium text-ink-2">
            <th className="px-3 py-2 font-medium">检索策略</th>
            {categories.map((category) => (
              <th key={category} className="px-3 py-2 font-medium">
                {category}
              </th>
            ))}
            <th className="px-3 py-2 font-medium">Hit@5</th>
            <th className="px-3 py-2 font-medium">MRR</th>
            <th className="px-3 py-2 font-medium">Recall@K</th>
            <th className="px-3 py-2 font-medium">Precision@K</th>
            <th className="px-3 py-2 font-medium">平均延迟</th>
          </tr>
        </thead>
        <tbody className="text-body-sm text-ink">
          {rows.map((run) => {
            const metrics = metricsOf(run);
            const perCase = details[run.run_id]?.per_case;
            const isDefault = run.mode === "hybrid_rerank";
            return (
              <tr
                key={run.run_id}
                className={isDefault ? "bg-surface-2" : "hover:bg-surface-2"}
              >
                <th scope="row" className="px-3 py-2 font-medium text-ink">
                  <span className="flex items-center gap-1.5">
                    {MODE_LABELS[run.mode] ?? run.mode}
                    {isDefault ? <Badge variant="neutral">当前默认</Badge> : null}
                  </span>
                </th>
                {categories.map((category) => {
                  let cell = "—";
                  if (perCase) {
                    const inCategory = perCase.filter(
                      (entry) => entry.in_metrics && entry.category === category,
                    );
                    cell = `${inCategory.filter((e) => e.hit).length}/${inCategory.length}`;
                  }
                  return (
                    <td key={category} className="px-3 py-2 text-numeric">
                      {cell}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-numeric">
                  {metrics ? `${metrics.hit_at_5.hits}/${metrics.hit_at_5.total}` : "—"}
                </td>
                <td className="px-3 py-2 text-numeric">
                  {metrics ? metrics.mrr.toFixed(4) : "—"}
                </td>
                <td className="px-3 py-2 text-caption text-ink-3">{NO_DATA}</td>
                <td className="px-3 py-2 text-caption text-ink-3">{NO_DATA}</td>
                <td className="px-3 py-2 text-caption text-ink-3">{NO_DATA}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* 逐例明细表(RunList 展开):skip 例排名/命中/RR 显式「跳过」+ 底部错误说明。 */
function PerCaseTable({ perCase }: { perCase: EvalCaseDetail[] }) {
  const skipped = perCase.filter((entry) => entry.skipped);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-2 text-caption font-medium text-ink-2">
            <th className="px-3 py-2 font-medium">用例</th>
            <th className="px-3 py-2 font-medium">类别</th>
            <th className="px-3 py-2 font-medium">问题</th>
            <th className="px-3 py-2 font-medium">期望行为</th>
            <th className="px-3 py-2 font-medium">首个期望排名</th>
            <th className="px-3 py-2 font-medium">命中</th>
            <th className="px-3 py-2 font-medium">RR</th>
          </tr>
        </thead>
        <tbody className="text-body-sm text-ink">
          {perCase.map((entry) => (
            <tr key={entry.case_id} className="hover:bg-surface-2">
              <td className="px-3 py-2 text-caption text-numeric">{entry.case_id}</td>
              <td className="px-3 py-2 text-ink-2">{entry.category}</td>
              <td className="px-3 py-2">{entry.query}</td>
              <td className="px-3 py-2 text-ink-2">
                {BEHAVIOR_LABELS[entry.expected_behavior] ?? entry.expected_behavior}
              </td>
              <td className="px-3 py-2 text-numeric">
                {entry.skipped ? "跳过" : entry.rank_of_first_expected ?? "—"}
              </td>
              <td className="px-3 py-2 text-numeric">
                {entry.skipped
                  ? "—"
                  : entry.in_metrics
                    ? entry.hit
                      ? "命中"
                      : "未命中"
                    : "—"}
              </td>
              <td className="px-3 py-2 text-numeric">
                {entry.rr === null ? "—" : entry.rr.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {skipped.length > 0 ? (
        <p className="mt-2 text-caption text-ink-3">
          跳过 {skipped.length} 例:{skipped.map((e) => `${e.case_id}(${e.error})`).join(";")}
        </p>
      ) : null}
    </div>
  );
}

/* 运行历史行:整行可点(ghost 语义),展开后按需拉取逐例明细。 */
function RunRow({
  run,
  expanded,
  onToggle,
  detail,
  loading,
  error,
}: {
  run: EvalRunSummary;
  expanded: boolean;
  onToggle: () => void;
  detail: EvalRunDetail | null | undefined;
  loading: boolean;
  error: string | null;
}) {
  const metrics = metricsOf(run);
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
      >
        <span className="min-w-44 text-body-sm font-medium text-ink">
          {MODE_LABELS[run.mode] ?? run.mode}
        </span>
        <StatusBadge status={run.status} />
        <span className="text-caption text-ink-2">{formatEvalTime(run.created_at)}</span>
        <span className="text-caption text-ink-3">
          params {run.params_hash.slice(0, 8)} · commit {run.doc_commit || "—"}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {run.status === "completed" ? (
            <span className="text-body-sm text-numeric">
              {metrics
                ? `Hit@5 ${metrics.hit_at_5.hits}/${metrics.hit_at_5.total} · MRR ${metrics.mrr.toFixed(4)}`
                : "—"}
            </span>
          ) : run.status === "failed" ? (
            <span className="text-body-sm text-danger-text">
              {runError(run) || "失败"}
            </span>
          ) : (
            <span className="text-body-sm text-ink-3">计算中…</span>
          )}
          <span className="w-10 text-right text-body-sm text-brand-600">
            {expanded ? "收起" : "展开"}
          </span>
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-hairline px-4 py-3">
          {loading ? (
            <div className="h-10 animate-skeleton rounded-md bg-surface-2" />
          ) : null}
          {error ? <p className="text-body-sm text-danger-text">{error}</p> : null}
          {detail?.per_case ? <PerCaseTable perCase={detail.per_case} /> : null}
          {detail && !detail.per_case ? (
            <p className="text-body-sm text-ink-2">
              本批(历史 CLI 批次)未存逐例明细,仅展示总指标;重新运行评测可生成逐例明细。
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function EvalPage() {
  const [runs, setRuns] = useState<EvalRunSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [details, setDetails] = useState<Record<string, EvalRunDetail | null>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [loadingDetails, setLoadingDetails] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await listEvalRuns();
      setRuns(next);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "评测记录加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const running = runs?.some((run) => run.status === "running") ?? false;

  // 运行中每 5 秒轮询;批次全部落定后停止
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [running, load]);

  const handleStart = async () => {
    setStartError(null);
    setStarting(true);
    try {
      await startEvalRun();
      await load();
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "启动评测失败");
      void load(); // 409(他处已在运行)时同步运行中状态
    } finally {
      setStarting(false);
    }
  };

  // 运行历史:按批次倒序,批内按模式固定序
  const sortedRuns = useMemo(() => {
    if (!runs) {
      return null;
    }
    return [...runs].sort((a, b) => {
      if (a.created_at !== b.created_at) {
        return b.created_at.localeCompare(a.created_at);
      }
      return MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode);
    });
  }, [runs]);

  const batches = useMemo(() => {
    if (!runs) {
      return [];
    }
    const groups = new Map<string, EvalRunSummary[]>();
    for (const run of runs) {
      const group = groups.get(run.created_at) ?? [];
      group.push(run);
      groups.set(run.created_at, group);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([createdAt, items]) => ({
        createdAt,
        items: [...items].sort(
          (a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode),
        ),
      }));
  }, [runs]);

  // 矩阵取最新完成批次;任何批次运行中 → 矩阵区骨架(完成后自动切换)
  const matrixBatch = running
    ? null
    : batches.find((batch) => batch.items.some((run) => run.status === "completed")) ??
      null;
  const matrixBatchKey = matrixBatch?.createdAt ?? null;

  // 矩阵批次逐例明细(7 类场景列取数);明细缺失的行单元格回退 "—"
  useEffect(() => {
    if (!matrixBatch) {
      setDetails({});
      return;
    }
    const batch = matrixBatch;
    let cancelled = false;
    void Promise.all(
      batch.items.map(async (run) => {
        if (!run.has_per_case) {
          return null;
        }
        try {
          return await getEvalRun(run.run_id);
        } catch {
          return null;
        }
      }),
    ).then((list) => {
      if (cancelled) {
        return;
      }
      const next: Record<string, EvalRunDetail | null> = {};
      for (const detail of list) {
        if (detail) {
          next[detail.run_id] = detail;
        }
      }
      setDetails(next);
    });
    return () => {
      cancelled = true;
    };
    // 批键足够:同批行集合由 created_at 决定
  }, [matrixBatchKey]);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const run of matrixBatch?.items ?? []) {
      const perCase = details[run.run_id]?.per_case;
      if (!perCase) {
        continue;
      }
      for (const entry of perCase) {
        if (entry.in_metrics && !seen.includes(entry.category)) {
          seen.push(entry.category);
        }
      }
    }
    return seen;
  }, [matrixBatch, details]);

  const perCaseAvailable =
    matrixBatch?.items.some((run) => run.has_per_case) ?? false;
  const failedInBatch = matrixBatch
    ? matrixBatch.items.filter((run) => run.status === "failed").length
    : 0;

  const toggleExpand = (run: EvalRunSummary) => {
    if (expanded === run.run_id) {
      setExpanded(null);
      return;
    }
    setExpanded(run.run_id);
    if (details[run.run_id] || loadingDetails.includes(run.run_id)) {
      return;
    }
    setLoadingDetails((prev) => [...prev, run.run_id]);
    void getEvalRun(run.run_id)
      .then((detail) => {
        setDetails((prev) => ({ ...prev, [run.run_id]: detail }));
        setDetailErrors((prev) => {
          const next = { ...prev };
          delete next[run.run_id];
          return next;
        });
      })
      .catch((error) => {
        setDetailErrors((prev) => ({
          ...prev,
          [run.run_id]: error instanceof Error ? error.message : "评测明细加载失败",
        }));
      })
      .finally(() => {
        setLoadingDetails((prev) => prev.filter((id) => id !== run.run_id));
      });
  };

  const hasAnyRuns = (runs?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="检索评测" />

      <section aria-label="评测矩阵" className="rounded-lg border border-hairline bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-heading-2 font-semibold text-ink">评测矩阵</h2>
            <p className="mt-0.5 text-body-sm text-ink-2">
              14 例评测问题(7 类场景)对三种检索策略同条件实测;默认展示最新完成批次。
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => void handleStart()}
            disabled={running || starting}
          >
            {running || starting ? (
              <span
                className="size-4 animate-spin rounded-full border-2 border-ink-inverse/30 border-t-ink-inverse"
                aria-hidden="true"
              />
            ) : (
              <IconPlay className="size-4" />
            )}
            {running ? "评测运行中…" : starting ? "启动中…" : "运行评测"}
          </Button>
        </div>
        {startError ? (
          <p className="border-b border-hairline bg-danger-bg px-4 py-2.5 text-body-sm text-danger-text">
            {startError}
          </p>
        ) : null}
        {listError ? (
          <div className="px-4 py-3">
            <p className="text-body-sm text-danger-text">{listError}</p>
            <Button
              variant="secondary"
              size="md"
              className="mt-2"
              onClick={() => void load()}
            >
              重试
            </Button>
          </div>
        ) : runs === null ? (
          <SkeletonRows />
        ) : running ? (
          <>
            <SkeletonRows />
            <p className="border-t border-hairline px-4 py-2.5 text-caption text-ink-3">
              评测运行中,预计需要数分钟;本页每 5 秒自动刷新状态,完成后自动呈现结果。
            </p>
          </>
        ) : !hasAnyRuns ? (
          <EmptyState
            icon={<IconGauge />}
            title="暂无评测数据"
            description="点击右上角「运行评测」,在演示知识库上跑三模式检索评测(约需数分钟)。"
          />
        ) : matrixBatch ? (
          <>
            <MatrixTable
              rows={matrixBatch.items.filter((run) => run.status === "completed")}
              categories={categories}
              details={details}
            />
            {!perCaseAvailable ? (
              <p className="border-t border-hairline px-4 py-2.5 text-caption text-ink-3">
                本批次未存逐例明细(历史 CLI 批次仅记录总指标),场景列不展示;重新运行评测可生成逐例明细。
              </p>
            ) : null}
            <div className="border-t border-hairline px-4 py-2.5">
              <p className="text-caption text-ink-3">
                「暂无数据」= 该指标尚未纳入评测引擎,不做虚构;随评测引擎扩展由 run JSON 回填。
              </p>
              <p className="mt-0.5 text-caption text-ink-3">
                数据来源:run {matrixBatch.items[0].run_id} · params_hash{" "}
                {matrixBatch.items[0].params_hash} · doc_commit{" "}
                {matrixBatch.items[0].doc_commit || "—"} ·{" "}
                {formatEvalTime(matrixBatch.createdAt)} 实测
              </p>
              {failedInBatch > 0 ? (
                <p className="mt-0.5 text-caption text-ink-3">
                  本批 {failedInBatch} 个模式失败,原因见运行历史。
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<IconGauge />}
            title="暂无已完成的评测结果"
            description="运行历史中有记录但无成功批次;点击右上角「运行评测」生成最新批次。"
          />
        )}
      </section>

      <section aria-label="运行历史" className="rounded-lg border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="text-heading-2 font-semibold text-ink">运行历史</h2>
          <p className="mt-0.5 text-body-sm text-ink-2">
            每次「运行评测」生成一批三模式记录;点击行展开逐例明细。
          </p>
        </div>
        {sortedRuns === null ? (
          <SkeletonRows rows={2} />
        ) : sortedRuns.length === 0 ? (
          <p className="px-4 py-3 text-body-sm text-ink-3">暂无运行记录。</p>
        ) : (
          <ul>
            {sortedRuns.map((run) => (
              <RunRow
                key={run.run_id}
                run={run}
                expanded={expanded === run.run_id}
                onToggle={() => toggleExpand(run)}
                detail={details[run.run_id]}
                loading={loadingDetails.includes(run.run_id)}
                error={detailErrors[run.run_id] ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="默认策略说明"
        className="rounded-lg border border-hairline bg-surface px-4 py-4"
      >
        <h2 className="text-heading-2 font-semibold text-ink">为什么默认 Hybrid + Rerank</h2>
        <p className="mt-1 text-body-md text-ink-2">
          测试问题集(14 例 7 类,来自评测集 cases.yaml)→ 三种检索策略同条件实测 →
          指标对比 → 确定默认策略。普通用户在知识问答页不需要选择检索策略,
          系统固定使用当前已验证的最佳组合。
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-body-md text-ink-2">
          <li>· 向量搜索:基础方案,语义召回。</li>
          <li>· 混合搜索:兼顾语义与关键词,RRF 融合。</li>
          <li>· 混合+重排:在候选结果上进一步优化相关性。</li>
        </ul>
        <p className="mt-3 text-body-md font-medium text-ink">
          KnowFlow 当前默认使用 Hybrid + Rerank。
        </p>
        <p className="mt-2 text-caption text-ink-3">
          诚实边界:演示知识库上三模式评测全部达标,数值随最新批次实测动态更新(见上方评测矩阵)。
          最终策略由评测结果决定,不预设「重排一定最好」;若未来评测显示其他模式更适合某些场景,默认策略随实测调整。
        </p>
      </section>
    </div>
  );
}
