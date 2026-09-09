"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/* 删除确认模态(DesignRules 文档库页):danger 二次确认;遮罩 overlay-light +
   floating 阴影 + 圆角 12px;Esc/点遮罩关闭,处理中锁定。
   「确认删除」是该上下文唯一的 primary(danger 档,DesignRules 按钮层级)。 */

export interface ConfirmModalProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = "确认删除",
  cancelLabel = "取消",
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-overlay-light"
        onClick={pending ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-[400px] rounded-xl bg-surface p-6 shadow-floating"
      >
        <h2
          id="confirm-modal-title"
          className="text-heading-2 font-semibold text-ink"
        >
          {title}
        </h2>
        <div className="mt-2 text-body-md text-ink-2">{description}</div>
        {error ? (
          <p role="alert" className="mt-2 text-caption text-danger-text">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
            autoFocus
          >
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
