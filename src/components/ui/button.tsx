import type { ButtonHTMLAttributes } from "react";

/* 按钮:高度 36px、圆角 6px、标签 14px/500(DesignSystem front matter)。
   层级纪律:每屏仅一个 primary;danger 仅用于删除确认。 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-ink-inverse hover:bg-brand-700 active:bg-brand-800 disabled:bg-surface-2 disabled:text-ink-disabled",
  secondary:
    "border border-hairline-strong bg-surface text-ink hover:bg-surface-2 disabled:text-ink-disabled",
  ghost:
    "bg-transparent text-ink-2 hover:bg-surface-2 disabled:text-ink-disabled",
  danger:
    "bg-danger text-ink-inverse hover:bg-danger/90 disabled:bg-surface-2 disabled:text-ink-disabled",
  icon: "bg-transparent text-ink-2 hover:bg-surface-2 disabled:text-ink-disabled",
};

const sizeClasses: Record<"md" | "icon", string> = {
  md: "h-9 gap-1.5 px-3.5 text-[14px] font-medium leading-[1.3]",
  icon: "size-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "icon";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-sm transition-colors duration-150 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
