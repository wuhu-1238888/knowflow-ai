"use client";

import { useState } from "react";
import { IconClose, IconMenu } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/sidebar";
import { NAV_ITEMS, NavItem } from "@/components/shell/nav";

/* 移动端顶栏:<1024px 显示,48px 白底 + 底部发丝线;菜单抽屉 360px 全高(DesignSystem)。 */

export function TopBar({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex h-12 items-center justify-between border-b border-hairline bg-surface px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <BrandMark size={16} />
          <span className="text-heading-3 font-semibold text-ink">KnowFlow</span>
        </div>
        <Button
          variant="icon"
          aria-label="打开导航菜单"
          onClick={() => setOpen(true)}
        >
          <IconMenu className="size-4" />
        </Button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="关闭菜单(点击遮罩)"
            className="absolute inset-0 h-full w-full bg-overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-90 max-w-[360px] flex-col bg-surface shadow-floating">
            <div className="flex h-12 items-center justify-between border-b border-hairline px-4">
              <div className="flex items-center gap-2">
                <BrandMark size={16} />
                <span className="text-heading-3 font-semibold text-ink">
                  KnowFlow
                </span>
              </div>
              <Button
                variant="icon"
                aria-label="关闭导航菜单"
                onClick={() => setOpen(false)}
              >
                <IconClose className="size-4" />
              </Button>
            </div>
            <nav aria-label="主导航" className="flex flex-col gap-1 p-2">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
