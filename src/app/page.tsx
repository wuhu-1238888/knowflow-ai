import { IconQuestion } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/* 问答页骨架:完整交互(AnswerSheet/引用/拒答)在任务 3.3.2 实现。 */

export default function AskPage() {
  return (
    <div>
      <PageHeader title="知识问答" />
      <EmptyState
        icon={<IconQuestion />}
        title="问答功能实施中"
        description="任务 3.3.2 将在这里交付:提问 → 带引用的答卷式回答 → 点开来源核对 → 无答案时明确拒答。"
      />
    </div>
  );
}
