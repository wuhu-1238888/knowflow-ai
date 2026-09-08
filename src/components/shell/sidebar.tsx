import Link from "next/link";
import { NAV_ITEMS, NavItem } from "@/components/shell/nav";

/* 品牌标记:18px 渐变方块 + 白色"知识流"三条折线(DesignSystem 渐变白名单 ①品牌标记)。
   logo 尺寸取自组件尺寸,不改比例。 */

export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-sm bg-ai-gradient"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 18 18"
        width={Math.round(size * 0.72)}
        height={Math.round(size * 0.72)}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2.5 5.5c3.5 1.8 5 1.8 8.5 0s4.5-1.8 4.5 0"
          stroke="var(--color-ink-inverse)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M2.5 9c3.5 1.8 5 1.8 8.5 0s4.5-1.8 4.5 0"
          stroke="var(--color-ink-inverse)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M2.5 12.5c3.5 1.8 5 1.8 8.5 0s4.5-1.8 4.5 0"
          stroke="var(--color-ink-inverse)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
    </span>
  );
}

/* 侧栏:224px 白底 + 右侧发丝线,≥1024px 显示(DesignSystem 布局解剖)。 */

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-hairline bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2 px-4">
        <BrandMark />
        <Link
          href="/"
          className="text-[16px] font-semibold tracking-[-0.01em] text-ink"
        >
          KnowFlow
        </Link>
      </div>
      <nav aria-label="主导航" className="flex flex-1 flex-col gap-1 px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </nav>
      <div className="space-y-1 px-4 pb-4">
        <p className="text-caption text-ink-3">v0.1.0</p>
        <p className="text-caption text-ink-3">
          演示数据为虚构企业 NovaTech(synthetic)
        </p>
      </div>
    </aside>
  );
}
