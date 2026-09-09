"use client";

/* 引用 chip(CitationChip):[n] 方形 mono chip(DesignSystem AI 特有组件 2)。
   悬停/聚焦反色(brand-600 底白字)并触发双向联动;点击滑出来源抽屉。
   热区:移动端 ≥ 44px,桌面 ≥ 32px;缺失引用(回答中出现但依据带无对应编号)
   显示灰态不可点 + title 提示,不静默。 */

export interface CitationChipProps {
  index: number;
  missing?: boolean;
  active?: boolean;
  onClick?: () => void;
  onHover?: (index: number | null) => void;
  className?: string;
}

export function CitationChip({
  index,
  missing = false,
  active = false,
  onClick,
  onHover,
  className = "",
}: CitationChipProps) {
  const base = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm px-1 font-mono text-[12px] transition-colors duration-150 lg:min-h-8 lg:min-w-8";
  if (missing) {
    return (
      <span
        title="引用来源缺失,无法核对原文"
        className={`${base} bg-surface-2 text-ink-disabled ${className}`}
      >
        [{index}]
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`查看来源 [${index}]`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(index)}
      onBlur={() => onHover?.(null)}
      className={`${base} ${
        active
          ? "bg-brand-600 text-ink-inverse"
          : "bg-brand-100 text-brand-800 hover:bg-brand-600 hover:text-ink-inverse"
      } ${className}`}
    >
      [{index}]
    </button>
  );
}
