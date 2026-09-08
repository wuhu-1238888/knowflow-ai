import type { InputHTMLAttributes } from "react";

/* 文本输入:高度 40px、圆角 6px;焦点态 = brand 描边 + 3px focus-ring(DesignSystem)。 */

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-sm border border-hairline-strong bg-surface px-3 text-body-md text-ink transition-colors duration-150 placeholder:text-ink-disabled focus:border-brand-600 focus:ring-[3px] focus:ring-focus-ring ${className}`}
      {...props}
    />
  );
}
