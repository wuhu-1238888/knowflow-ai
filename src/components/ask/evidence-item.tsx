"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/lib/rag";
import { formatUploadDate, sourceMeta } from "./source-meta";

/* 依据条目(EvidenceItem,DesignSystem AI 特有组件 3):
   [n] 编号 chip(中性灰底 + 灰字,层级低于正文引用 chip)· 文档标题(heading-3)
   · 章节/更新时间 caption · 引用片段(evidence-quote:surface-2 底 + 2px
   brand-100 左边线,最多 4 行可展开)· 元信息行(来源徽标 ·「查看原文」)。
   二轮收蓝(2026-09-11):相关度分数不进普通用户视图(保留在 API 与评测页)。
   双向联动:悬停条目 → 回答正文对应引用句高亮;被 chip 悬停反向高亮时
   brand-600 描边并滚动进入视口。 */

const EXPAND_THRESHOLD = 160; // 4 行 13px 粗略容纳量,超长引用提供展开

export interface EvidenceItemProps {
  citation: Citation;
  active?: boolean;
  onHover?: (index: number | null) => void;
  onOpen?: (citation: Citation) => void;
}

export function EvidenceItem({
  citation,
  active = false,
  onHover,
  onOpen,
}: EvidenceItemProps) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const source = sourceMeta(citation.source);
  const uploadedAt = formatUploadDate(citation.doc_uploaded_at);
  const expandable = citation.quote.length > EXPAND_THRESHOLD;

  /* chip 悬停反向联动:高亮 + 滚动进入视口(双向联动 ①) */
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [active]);

  return (
    <li
      ref={ref}
      onMouseEnter={() => onHover?.(citation.index)}
      onMouseLeave={() => onHover?.(null)}
      className={`rounded-md border p-3 transition-colors duration-150 ${
        active ? "border-brand-600" : "border-hairline"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* 编号 chip:纯展示,中性灰(与正文蓝色引用 chip 形成层级;悬停联动由条目整体承担) */}
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm bg-surface-2 px-1 text-code-sm text-ink-2 lg:min-h-8 lg:min-w-8"
        >
          [{citation.index}]
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-heading-3 font-medium text-ink">
            {citation.doc_title}
          </h3>
          <p className="mt-0.5 text-caption text-ink-3">
            {citation.doc_format ? `${citation.doc_format} · ` : ""}
            {uploadedAt ? `上传于 ${uploadedAt}` : ""}
          </p>
        </div>
      </div>
      <blockquote
        className={`mt-2 border-l-2 border-brand-100 bg-surface-2 px-3 py-2 text-body-sm text-ink-2 ${
          expandable && !expanded ? "line-clamp-4" : ""
        }`}
      >
        {citation.quote}
      </blockquote>
      {expandable ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-caption text-brand-800 transition-colors duration-150 hover:underline"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={source.variant}>{source.label}</Badge>
        <button
          type="button"
          onClick={() => onOpen?.(citation)}
          className="ml-auto text-caption text-brand-800 transition-colors duration-150 hover:underline"
        >
          查看原文
        </button>
      </div>
    </li>
  );
}
