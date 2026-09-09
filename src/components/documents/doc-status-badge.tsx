import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/components/ask/source-meta";

/* 文档状态徽标(DesignSystem #7):已索引 success · 解析中 info · 解析失败 danger ·
   待索引 neutral。DB 三态(parsing/indexed/failed)+ UI 兜底态 pending
   (= 上传瞬间,config.py 口径),共四态。 */

export type DocStatus = "parsing" | "indexed" | "failed" | "pending";

export function DocStatusBadge({ status }: { status: DocStatus }) {
  const meta = statusMeta(status);
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/** 文档格式徽标:file_type → 大写文本徽标(neutral 语义,与状态徽标区分)。 */
export function DocFormatBadge({ fileType }: { fileType: string }) {
  return <Badge variant="neutral">{fileType.toUpperCase()}</Badge>;
}
