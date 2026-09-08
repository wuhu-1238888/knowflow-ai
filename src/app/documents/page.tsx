import { IconFiles } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/* 文档库页骨架:上传/列表/删除在任务 3.3.3 实现。 */

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader title="文档库" />
      <EmptyState
        icon={<IconFiles />}
        title="文档库实施中"
        description="任务 3.3.3 将在这里交付:上传文档 → 解析入库 → 状态徽标追踪 → 危险删除需二次确认。"
      />
    </div>
  );
}
