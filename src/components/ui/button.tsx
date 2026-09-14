import type { ButtonHTMLAttributes } from "react";

/* 按钮:高度 36px、圆角 6px、标签 14px/500(DesignSystem front matter)。
   层级纪律:每屏仅一个 primary;danger 仅用于删除确认。
   loading(2026-09-14):16px 细环 spinner(DesignSystem 唯一允许的旋转加载
   图标)+ 强制禁用;primary 换浅蓝底 + 蓝字降强调(不是灰色报错态,
   也不是全蓝强调)——整体换类串,不与 disabled: 变体类共存冲突。 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-ink-inverse hover:bg-brand-700 active:bg-brand-800 disabled:bg-surface-2 disabled:text-ink-disabled",
  secondary:
    "border border-hairline-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-3 disabled:text-ink-disabled",
  ghost:
    "bg-transparent text-ink-2 hover:bg-surface-2 active:bg-surface-3 disabled:text-ink-disabled",
  danger:
    "bg-danger text-ink-inverse hover:bg-danger/90 active:bg-danger-dark disabled:bg-surface-2 disabled:text-ink-disabled",
  icon: "bg-transparent text-ink-2 hover:bg-surface-2 active:bg-surface-3 disabled:text-ink-disabled",
};

const loadingClasses: Record<Variant, string> = {
  primary: "bg-brand-100 text-brand-600",
  secondary: "border border-hairline-strong bg-surface text-ink-disabled",
  ghost: "bg-transparent text-ink-disabled",
  danger: "bg-danger-bg text-danger-text",
  icon: "bg-transparent text-ink-disabled",
};

const sizeClasses: Record<"md" | "icon", string> = {
  md: "h-9 gap-1.5 px-3.5 text-[14px] font-medium leading-[1.3]",
  icon: "size-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "icon";
  /** 进行中:spinner + 强制禁用 + 降强调配色(替换本 variant 的整段类,无类序冲突)。 */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-sm transition-colors duration-150 disabled:cursor-not-allowed ${loading ? loadingClasses[variant] : variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
      ) : null}
      {children}
    </button>
  );
}
