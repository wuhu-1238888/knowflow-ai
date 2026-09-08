import type { ReactNode } from "react";

/* 页面头:高度 64px,标题 display-lg 28px/600,右侧操作区(DesignSystem 布局解剖)。 */

export interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-4">
      <h1 className="text-display-lg font-semibold text-ink">{title}</h1>
      {children}
    </header>
  );
}
