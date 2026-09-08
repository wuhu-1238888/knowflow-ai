import type { ReactNode } from "react";

/* 空状态:图标 24px ink-3 + 标题 16px/600 + 说明 13px ink-2 + 一个 secondary 操作;无插画。 */

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 text-ink-3 [&>svg]:size-6">{icon}</div>
      <h2 className="text-heading-2 font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="max-w-[420px] text-body-sm text-ink-2">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
