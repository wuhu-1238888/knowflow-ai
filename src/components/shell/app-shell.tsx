"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";

/* 应用外壳:左侧栏 + 主内容列。
 * 滚动模型(2026-09-14 人规格):侧栏 fixed 固定在视口左侧(自身 overflow-y-auto,
 * 内容超高时内部滚动);主内容随 document 滚动——沿用浏览器原生行为,路由切换
 * 自动回顶、返回恢复滚动位置(3.6.3 依赖)均不受影响;内容列 lg:pl-56(224px)
 * 让位给固定侧栏,无重叠、无横向溢出。无独立滚动容器,无双滚动条。
 * 内容容器宽度按路由分档(DesignSystem containers,2026-09-09 人拍板
 * 「宽幅居中 + max-width 封顶」,2026-09-14 关于页并入阅读型 960 档):
 * 知识问答·关于 960(阅读型)/ 评测·文档库 1152(数据型);
 * 未登记路由回落默认档。居中 + 响应式 padding,1920px 下由 max-width 封顶。 */

const CONTENT_WIDTH: Record<string, string> = {
  "/": "max-w-[960px]",
  "/eval": "max-w-[1152px]",
  "/documents": "max-w-[1152px]",
  "/about": "max-w-[960px]",
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
      {/* lg:pl-56 = 让位给 fixed 侧栏(224px);<1024px 侧栏收起,左内边距归零 */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <TopBar pathname={pathname} />
        <main className={`mx-auto w-full flex-1 ${contentWidthFor(pathname)} px-4 pb-12 sm:px-6`}>
          {children}
        </main>
      </div>
    </div>
  );
}
