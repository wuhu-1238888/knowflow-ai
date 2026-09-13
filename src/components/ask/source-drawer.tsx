"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { IconClose } from "@/components/icons";
import type { Citation } from "@/lib/rag";
import { formatUploadDate, sourceMeta, statusMeta } from "./source-meta";

/* 来源抽屉(SourceDrawer,DesignSystem AI 特有组件 4):点「查看原文」或引用 chip 滑出。
   右侧 360px(motion.medium 200ms 滑入,遮罩 overlay-light 0.16),标题 20px/600,
   元信息(格式徽标 · 状态徽标 · 上传时间)+ 完整 chunk 原文(可滚动,无分页)
   + 来源模式徽标(弱中性元数据)+「在文档库中查看」链接;Esc 关闭。
   二轮收蓝(2026-09-11):相关度分数不进普通用户视图(保留在 API 与评测页)。 */

export interface SourceDrawerProps {
  citation: Citation;
  onClose: () => void;
}

export function SourceDrawer({ citation, onClose }: SourceDrawerProps) {
  /* 挂载后置 visible 触发滑入过渡(reduced-motion 由全局样式压成瞬时) */
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const source = sourceMeta(citation.source);
  const status = statusMeta(citation.doc_status);
  const uploadedAt = formatUploadDate(citation.doc_uploaded_at);
  /* 引用句视觉定位(2026-09-13 闭环优化):quote 规则侧保证为 chunk 原文子串,
     在完整原文中高亮首次出现位置(Answer → Citation → Chunk → 原文)。 */
  const quoteAt = citation.text.indexOf(citation.quote);
  const quoteHighlighted =
    citation.quote.length > 0 && quoteAt !== -1;

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-overlay-light transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`来源 [${citation.index}]:${citation.doc_title}`}
        className={`absolute right-0 top-0 flex h-full w-[360px] max-w-full flex-col border-l border-hairline bg-surface shadow-floating transition-transform duration-200 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-heading-1 font-semibold text-ink">
              {citation.doc_title}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {citation.doc_format ? (
                <Badge variant="neutral">{citation.doc_format}</Badge>
              ) : null}
              <Badge variant={status.variant}>{status.label}</Badge>
              {uploadedAt ? (
                <span className="text-caption text-ink-3">
                  上传于 {uploadedAt}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            title="关闭"
            aria-label="关闭来源抽屉"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-2 transition-colors duration-150 hover:bg-surface-2"
          >
            <IconClose className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {quoteHighlighted ? (
            <p className="mb-2 text-caption text-ink-3">
              回答引用的片段已在原文中高亮
            </p>
          ) : null}
          <p className="whitespace-pre-line text-body-lg text-ink">
            {quoteHighlighted ? (
              <>
                {citation.text.slice(0, quoteAt)}
                <mark className="rounded-sm bg-brand-50 px-0.5 text-ink">
                  {citation.quote}
                </mark>
                {citation.text.slice(quoteAt + citation.quote.length)}
              </>
            ) : (
              citation.text
            )}
          </p>
          <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
            <Badge variant={source.variant}>{source.label}</Badge>
          </div>
          {/* 2026-09-13 闭环优化:真实定位到该文档详情页(原为列表页伪链接) */}
          <Link
            href={`/documents/${encodeURIComponent(citation.doc_id)}`}
            className="mt-3 inline-block text-body-sm text-brand-800 transition-colors duration-150 hover:underline"
          >
            在文档库中查看
          </Link>
        </div>
      </aside>
    </div>
  );
}
