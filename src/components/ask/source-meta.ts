import type { BadgeVariant } from "@/components/ui/badge";
import { formatUploadDate } from "@/lib/format";

/* 来源/文档状态 → 徽标语义映射(DesignSystem:来源徽标与文档状态徽标语义固定,禁止换用)。
   EvidenceItem 与 SourceDrawer 共用;formatUploadDate 已迁至 lib/format(文档库页共用),
   此处重导出保持既有引用不变。 */

export const SOURCE_META: Record<
  string,
  { label: string; variant: BadgeVariant } | undefined
> = {
  keyword: { label: "关键词", variant: "mode-keyword" },
  vector: { label: "向量", variant: "mode-vector" },
  hybrid: { label: "混合", variant: "mode-hybrid" },
};

export const STATUS_META: Record<
  string,
  { label: string; variant: BadgeVariant } | undefined
> = {
  indexed: { label: "已索引", variant: "success" },
  parsing: { label: "解析中", variant: "info" },
  failed: { label: "解析失败", variant: "danger" },
};

export function sourceMeta(source: string): {
  label: string;
  variant: BadgeVariant;
} {
  return SOURCE_META[source] ?? { label: source || "未知来源", variant: "neutral" };
}

export function statusMeta(status: string): {
  label: string;
  variant: BadgeVariant;
} {
  return STATUS_META[status] ?? { label: "待索引", variant: "neutral" };
}

export { formatUploadDate };
