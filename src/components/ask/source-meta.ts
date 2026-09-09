import type { BadgeVariant } from "@/components/ui/badge";

/* 来源/文档状态 → 徽标语义映射(DesignSystem:来源徽标与文档状态徽标语义固定,禁止换用)。
   EvidenceItem 与 SourceDrawer 共用。 */

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

/** 上传时间 ISO → 日期(YYYY-MM-DD);空串/非法 → 空串(展示层回退不显示)。 */
export function formatUploadDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "";
}
