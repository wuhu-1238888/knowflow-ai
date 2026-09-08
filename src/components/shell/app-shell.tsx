"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";

/* 应用外壳:左侧栏 + 主内容列(内容区最大 760px,DesignSystem 布局解剖)。 */

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pathname={pathname} />
        <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-12 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
