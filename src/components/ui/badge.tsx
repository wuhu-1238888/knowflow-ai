import type { HTMLAttributes } from "react";

/* 徽标:高度 22px、圆角 6px、12px 文字;方形,不用胶囊(DesignRules 胶囊白名单)。
   语义固定:状态徽标(neutral/success/info/danger/warning)+ 检索模式徽标(mode-*),禁止换用。 */

export type BadgeVariant =
  | "neutral"
  | "success"
  | "info"
  | "danger"
  | "warning"
  | "mode-keyword"
  | "mode-vector"
  | "mode-hybrid";

const badgeClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-ink-2",
  success: "bg-success-bg text-success-text",
  info: "bg-info-bg text-info",
  danger: "bg-danger-bg text-danger-text",
  warning: "bg-warning-bg text-warning",
  "mode-keyword": "bg-mode-keyword-bg text-mode-keyword",
  "mode-vector": "bg-mode-vector-bg text-mode-vector",
  "mode-hybrid": "bg-mode-hybrid-bg text-mode-hybrid",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-sm px-2 text-caption ${badgeClasses[variant]} ${className}`}
      {...props}
    />
  );
}
