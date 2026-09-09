import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

/* 评测页(3.3.4 提前切片):检索策略对比 + 选型叙事。
 * 2026-09-09 人拍板:三模式对比从问答页迁至此,回答「为什么默认 Hybrid + Rerank」。
 * 数字全部来自实测 run JSON(2026-09-09T063730Z 三模式检索层评测,FR-08 复验通过),
 * 未纳入评测引擎的指标(Recall@K/Precision@K/平均延迟)显式标注「暂无数据」,禁止虚构。
 * 3.3.4 全量:运行评测按钮 / RunList 运行历史 / per-case 明细 / 动态数据接入。 */

const STRATEGY_ROWS = [
  {
    strategy: "向量搜索(Vector)",
    role: "基础方案",
    hitAt5: "12/12",
    mrr: "0.9583",
    isDefault: false,
  },
  {
    strategy: "混合搜索(Hybrid)",
    role: "兼顾语义与关键词",
    hitAt5: "12/12",
    mrr: "0.9028",
    isDefault: false,
  },
  {
    strategy: "混合+重排(Hybrid + Rerank)",
    role: "在候选结果上进一步优化相关性",
    hitAt5: "12/12",
    mrr: "0.9583",
    isDefault: true,
  },
] as const;

const NO_DATA = "暂无数据";

export default function EvalPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="评测" />

      <section
        aria-label="检索策略对比"
        className="rounded-lg border border-hairline bg-surface"
      >
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="text-heading-2 font-semibold text-ink">检索策略对比</h2>
          <p className="mt-0.5 text-body-sm text-ink-2">
            14 例评测问题(7 类场景)对三种检索策略同条件实测。
          </p>
        </div>
        <div className="overflow-x-auto px-4 py-3">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-2 text-caption font-medium text-ink-2">
                <th className="px-3 py-2 font-medium">检索策略</th>
                <th className="px-3 py-2 font-medium">产品定位</th>
                <th className="px-3 py-2 font-medium">Hit@5</th>
                <th className="px-3 py-2 font-medium">MRR</th>
                <th className="px-3 py-2 font-medium">Recall@K</th>
                <th className="px-3 py-2 font-medium">Precision@K</th>
                <th className="px-3 py-2 font-medium">平均延迟</th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-ink">
              {STRATEGY_ROWS.map((row) => (
                <tr
                  key={row.strategy}
                  className={row.isDefault ? "bg-surface-2" : "hover:bg-surface-2"}
                >
                  <th scope="row" className="px-3 py-2 font-medium text-ink">
                    <span className="flex items-center gap-1.5">
                      {row.strategy}
                      {row.isDefault ? <Badge variant="neutral">当前默认</Badge> : null}
                    </span>
                  </th>
                  <td className="px-3 py-2 text-ink-2">{row.role}</td>
                  <td className="px-3 py-2 text-numeric">{row.hitAt5}</td>
                  <td className="px-3 py-2 text-numeric">{row.mrr}</td>
                  <td className="px-3 py-2 text-caption text-ink-3">{NO_DATA}</td>
                  <td className="px-3 py-2 text-caption text-ink-3">{NO_DATA}</td>
                  <td className="px-3 py-2 text-caption text-ink-3">{NO_DATA}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-hairline px-4 py-2.5">
          <p className="text-caption text-ink-3">
            「暂无数据」= 该指标尚未纳入评测引擎,不做虚构;随评测引擎扩展由 run JSON 回填。
          </p>
          <p className="mt-0.5 text-caption text-ink-3">
            数据来源:docs/eval-results/run-2026-09-09T063730Z-{"{vector,hybrid,hybrid_rerank}"}.json
            · params_hash 365740ee · doc_commit 6190456 · 2026-09-09 实测(静态快照,动态数据源在 3.3.4 接入)
          </p>
        </div>
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
          诚实边界:当前演示知识库上三模式 Hit@5 均为 12/12;混合+重排 MRR 0.9583,与向量并列最高。
          最终策略由评测结果决定,不预设「重排一定最好」;若未来评测显示其他模式更适合某些场景,默认策略随实测调整。
        </p>
      </section>
    </div>
  );
}
