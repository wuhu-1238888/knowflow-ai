import { IconInfo } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/* 关于页骨架:项目说明与 synthetic 声明在任务 3.3.5 实现。 */

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="关于" />
      <EmptyState
        icon={<IconInfo />}
        title="关于页实施中"
        description="任务 3.3.5 将在这里交付:项目介绍、技术栈说明与演示数据声明(NovaTech 为虚构企业,synthetic)。"
      />
    </div>
  );
}
