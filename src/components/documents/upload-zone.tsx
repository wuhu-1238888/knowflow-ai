"use client";

import { useState } from "react";

/* 上传区(DesignSystem #8):发丝虚线框卡(圆角 10px、内边距 32px)+ 支持格式 mono 列表 +
   无 OCR 说明;拖拽悬停 = brand 虚线 + brand-50 底;点击/键盘触发浏览。
   上传进度按「表格行内」呈现(页面乐观行),本组件不渲染进度、无全局遮罩。 */

export const SUPPORTED_FORMATS = [".md", ".pdf", ".docx", ".html", ".txt"];

export function isSupportedFormat(name: string): boolean {
  return SUPPORTED_FORMATS.some((ext) => name.toLowerCase().endsWith(ext));
}

export interface UploadZoneProps {
  onBrowse: () => void;
  onFile: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

export function UploadZone({
  onBrowse,
  onFile,
  disabled = false,
  error = null,
}: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFile(file);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="拖入或选择文档上传"
        onClick={() => {
          if (!disabled) {
            onBrowse();
          }
        }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onBrowse();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border border-dashed p-8 text-center outline-none transition-colors duration-150 ${
          disabled
            ? "cursor-not-allowed border-hairline bg-surface-2 opacity-70"
            : dragging
              ? "cursor-pointer border-brand-600 bg-brand-50"
              : "cursor-pointer border-hairline-strong bg-surface hover:border-brand-600 hover:bg-brand-50"
        }`}
      >
        <p className="text-heading-3 font-semibold text-ink">拖入或选择文档</p>
        <p className="mt-1 font-mono text-code-sm text-ink-2">
          {SUPPORTED_FORMATS.join(" ")}
        </p>
        <p className="mt-1 text-caption text-ink-3">不支持 OCR,扫描件请先转文本</p>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-caption text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
