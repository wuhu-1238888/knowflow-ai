"use client";

import { useEffect, useRef } from "react";

/* 提问区(DesignRules 问答页):Enter 提交、Shift+Enter 换行、`/` 聚焦输入框。
   焦点态 = brand 描边 + 3px focus-ring(与 Input 同规格)。 */

export interface AskTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function AskTextarea({ value, onChange, onSubmit, disabled }: AskTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "TEXTAREA" && tag !== "INPUT") {
        event.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={3}
      value={value}
      disabled={disabled}
      placeholder="向知识库提问,例如:年假有几天?"
      aria-label="提问内容"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
        }
      }}
      className="w-full resize-none rounded-sm border border-hairline-strong bg-surface px-3 py-2 text-body-md text-ink transition-colors duration-150 placeholder:text-ink-disabled focus:border-brand-600 focus:ring-[3px] focus:ring-focus-ring disabled:bg-surface-2 disabled:text-ink-disabled"
    />
  );
}
