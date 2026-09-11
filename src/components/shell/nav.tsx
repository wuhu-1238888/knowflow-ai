import Link from "next/link";
import { IconFiles, IconGauge, IconInfo, IconQuestion } from "@/components/icons";

/* 全局导航配置:四个页面的唯一事实来源(侧栏 + 移动端抽屉共用)。 */

export const NAV_ITEMS = [
  { href: "/", label: "知识问答", icon: IconQuestion },
  { href: "/documents", label: "文档库", icon: IconFiles },
  { href: "/eval", label: "评测", icon: IconGauge },
  { href: "/about", label: "关于", icon: IconInfo },
] as const;

export type NavItemConfig = (typeof NAV_ITEMS)[number];

export function NavItem({
  item,
  active,
}: {
  item: NavItemConfig;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex h-9 items-center gap-2 rounded-sm px-2.5 text-body-md transition-colors duration-150 ${
        active
          ? "bg-brand-50 font-medium text-ink"
          : "text-ink-2 hover:bg-surface-2"
      }`}
    >
      {/* 选中态 = 状态提示而非视觉主角:非常浅蓝底 + 深色文字 + 蓝 icon(DesignSystem sidebar-item-active) */}
      <Icon className={`size-4 shrink-0 ${active ? "text-brand-600" : ""}`} />
      <span>{item.label}</span>
    </Link>
  );
}
