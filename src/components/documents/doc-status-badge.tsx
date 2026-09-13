import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/components/ask/source-meta";

/* 文档状态徽标(DesignSystem #7):已索引 success · 解析中 info · 解析失败 danger ·
   待索引 neutral。DB 三态(parsing/indexed/failed)+ UI 兜底态 pending
   (= 上传瞬间,config.py 口径),共四态。 */

export type DocStatus = "parsing" | "indexed" | "failed" | "pending";

export interface DocStatusBadgeProps {
  status: DocStatus;
  /** 失败原因(2026-09-13 闭环优化):区分「解析失败/索引失败」,
      并作为 badge 悬浮提示(不把技术细节铺在表格里)。 */
  lastError?: string | null;
}

export function DocStatusBadge({ status, lastError }: DocStatusBadgeProps) {
  const meta = statusMeta(status);
  /* failed 细分:后端失败原因以「解析失败:/索引失败:」前缀落库。 */
  const failedLabel =
    status === "failed" && lastError?.startsWith("索引失败")
      ? "索引失败"
      : meta.label;
  return (
    <Badge variant={meta.variant} title={lastError ?? undefined}>
      {failedLabel}
    </Badge>
  );
}

/** 文档格式徽标:file_type → 大写文本徽标(neutral 语义,与状态徽标区分)。 */
export function DocFormatBadge({ fileType }: { fileType: string }) {
  return <Badge variant="neutral">{fileType.toUpperCase()}</Badge>;
}
