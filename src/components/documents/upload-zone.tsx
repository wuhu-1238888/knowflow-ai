"use client";

import { useRef, useState } from "react";

import { IconUpload } from "@/components/icons";

/* 上传区(DesignSystem #8 + 2026-09-14 人规格重做):信息层级 = 线性 Upload
   图标 → 主标题「拖入或选择文档」→ 操作提示「点击选择文件,或将文件拖拽到
   此处」→ 支持格式 → OCR 限制说明,整体垂直居中,逐级弱化、不抢重点。
   Default = 中性浅灰虚线框 + 白底;Hover = 虚线变品牌蓝 + brand-50 浅蓝底 +
   图标轻染品牌蓝(仅 150ms 色彩过渡,无发光/无动画装饰);
   Drag Over = 品牌蓝实线 + brand-50 底 + 操作提示原位换「松开鼠标以上传」
   (不增行、无布局跳动;dragenter/dragleave 深度计数防子元素抖动);
   Error = danger 虚线 + danger-bg 底 + 卡内 role=alert 错误行(错误就在操作区);
   Uploading = 标题换「正在上传 {name}…」+ 全通道禁用防重复提交,结构不变,
   无假进度动画(真实进度 = 表格内乐观行)。
   键盘 = Enter/Space 触发浏览;焦点环走全局 :focus-visible(不再 outline-none)。
   上传/解析/索引逻辑不变,本组件只负责入口呈现与交互。 */

export const SUPPORTED_FORMATS = [".md", ".pdf", ".docx", ".html", ".txt"];

export function isSupportedFormat(name: string): boolean {
  return SUPPORTED_FORMATS.some((ext) => name.toLowerCase().endsWith(ext));
}

export interface UploadZoneProps {
  onBrowse: () => void;
  onFile: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
  /** 正在上传的文件名(非空 = 上传中状态:标题/提示切换,全通道禁用)。 */
  uploadingName?: string | null;
}

export function UploadZone({
  onBrowse,
  onFile,
  disabled = false,
  error = null,
  uploadingName = null,
}: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  /* 拖拽深度计数:子元素上的 dragenter/dragleave 会冒泡,计数防止状态抖动 */
  const dragDepth = useRef(0);
  const isDisabled = disabled || uploadingName !== null;

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (isDisabled) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFile(file);
    }
  };

  /* 边框样式状态互斥(整体换类串,避免同属性类平级冲突:2026-09-11 教训) */
  const stateClasses = isDisabled
    ? "cursor-not-allowed border-dashed border-hairline bg-surface-2"
    : error
      ? "cursor-pointer border-dashed border-danger bg-danger-bg"
      : dragging
        ? "cursor-pointer border-solid border-brand-600 bg-brand-50"
        : "cursor-pointer border-dashed border-hairline-strong bg-surface hover:border-brand-600 hover:bg-brand-50";
  const iconClass = isDisabled
    ? "size-6 text-ink-3"
    : error
      ? "size-6 text-danger-text"
      : dragging
        ? "size-6 text-brand-600"
        : "size-6 text-ink-3 transition-colors duration-150 group-hover:text-brand-600";

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      aria-label="拖入或选择文档上传"
      onClick={() => {
        if (!isDisabled) {
          onBrowse();
        }
      }}
      onKeyDown={(event) => {
        if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onBrowse();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!isDisabled) {
          dragDepth.current += 1;
          setDragging(true);
        }
      }}
      onDragOver={(event) => {
        /* 保持 drop 目标;状态由 dragenter/dragleave 计数维护 */
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
      className={`group rounded-lg border p-8 text-center transition-colors duration-150 ${stateClasses}`}
    >
      <div className="flex flex-col items-center">
        <IconUpload aria-hidden="true" className={iconClass} />
        <p className="mt-3 text-heading-2 font-semibold text-ink">
          {uploadingName ? (
            <span className="block max-w-full truncate">
              正在上传 {uploadingName}…
            </span>
          ) : (
            "拖入或选择文档"
          )}
        </p>
        <p className="mt-1.5 text-body-sm text-ink-2">
          {uploadingName
            ? "上传中,请稍候…"
            : dragging
              ? "松开鼠标以上传"
              : "点击选择文件,或将文件拖拽到此处"}
        </p>
        <p className="mt-2 text-body-sm text-ink-2">
          支持 <span className="font-mono">.md / .pdf / .docx / .html / .txt</span>
        </p>
        <p className="mt-1.5 text-caption text-ink-3">
          不支持扫描件 OCR,请先将扫描件转换为文本
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-3 w-full rounded-sm bg-surface px-2 py-1.5 text-body-sm text-danger-text"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
