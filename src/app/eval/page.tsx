import { IconGauge } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/* 评测页骨架:评测矩阵/运行历史在任务 3.3.4 实现。 */

export default function EvalPage() {
  return (
    <div>
      <PageHeader title="评测" />
      <EmptyState
        icon={<IconGauge />}
        title="评测页实施中"
        description="任务 3.3.4 将在这里交付:一键运行三模式对比 → 实测指标矩阵(禁手填数字)→ 可复现 run-id。"
      />
    </div>
  );
}
