"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";

/* 应用外壳:左侧栏 + 主内容列。
 * 内容容器宽度按路由分档(DesignSystem containers,2026-09-09 人拍板
 * 「宽幅居中 + max-width 封顶」):知识问答 960 / 评测·文档库 1152 / 关于 880;
 * 未登记路由回落默认档。居中 + 响应式 padding,1920px 下由 max-width 封顶。 */

const CONTENT_WIDTH: Record<string, string> = {
  "/": "max-w-[960px]",
  "/eval": "max-w-[1152px]",
  "/documents": "max-w-[1152px]",
  "/about": "max-w-[880px]",
};

/* 取首段路由映射容器宽度;未知路由回落默认档(containers.content-qa)。 */
function contentWidthFor(pathname: string): string {
  const segment = pathname === "/" ? "/" : `/${pathname.split("/")[1] ?? ""}`;
  return CONTENT_WIDTH[segment] ?? CONTENT_WIDTH["/"];
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pathname={pathname} />
        <main className={`mx-auto w-full flex-1 ${contentWidthFor(pathname)} px-4 pb-12 sm:px-6`}>
          {children}
        </main>
      </div>
    </div>
  );
}
