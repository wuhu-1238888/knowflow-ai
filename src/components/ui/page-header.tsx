import type { ReactNode } from "react";

/* 页面头:高度 64px,标题 display-lg 28px/600,右侧操作区(DesignSystem 布局解剖)。
 * subtitle 可选:标题下一行 body-sm ink-2 单行,克制(仅问答页使用)。 */

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-4">
      <div className="flex flex-col justify-center gap-0.5">
        <h1 className="text-display-lg font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="text-body-sm text-ink-2">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}
