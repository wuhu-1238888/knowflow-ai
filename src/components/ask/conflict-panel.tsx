"use client";

import { useState } from "react";

import { SourceDrawer } from "@/components/ask/source-drawer";
import { IconAlert, IconChevronDown } from "@/components/icons";
import { formatUploadDate } from "@/lib/format";
import type { Citation, ConflictItem } from "@/lib/rag";

/* 口径不一致 Trust Alert(3.4.5 重做,人下达 Trust UX 优化):
   - 属于当前 Answer 的 Trust/Evidence 层:由 AnswerSheet 内嵌渲染在回答正文
     之后、依据与来源之前,不再是独立大卡;视觉重量明显低于回答(小 warning
     图标 + warning-bg 浅底,禁红色错误样式,禁大面积橙色);
   - 默认只显示轻量提示「发现 N 份文档存在口径差异」+ 中立说明 +
     「查看冲突来源」;点击手风琴展开来源明细、再点收起,不默认展开全文;
   - 来源卡复用版本 citations 富化(标题/上传时间/「查看原文」→ SourceDrawer,
     与依据带同一套来源数据,不新造查看器);无匹配 citation 时降级为 doc_id
     纯文本且不显示「查看原文」;
   - 不伪造冲突点抽取:只展示冲突双方原文摘录(quote 由规则侧保证为原文子串)。 */

export interface ConflictPanelProps {
  conflicts: ConflictItem[];
  /** 当前回答版本的引用(用于来源富化;冲突双方 doc_id 与引用匹配)。 */
  citations?: Citation[];
}

function ConflictSourceCard({
  docId,
  quote,
  citation,
  onOpen,
}: {
  docId: string;
  quote: string;
  citation: Citation | undefined;
  onOpen: (citation: Citation) => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-hairline bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm font-medium text-ink">
          {citation ? citation.doc_title : docId}
        </p>
        {citation ? (
          <button
            type="button"
            onClick={() => onOpen(citation)}
            className="shrink-0 text-body-sm font-medium text-brand-800 transition-colors duration-150 hover:text-brand-700"
          >
            查看原文
          </button>
        ) : null}
      </div>
      {citation?.doc_uploaded_at ? (
        <p className="text-caption text-ink-3">
          上传于 {formatUploadDate(citation.doc_uploaded_at)}
        </p>
      ) : null}
      <p className="mt-0.5 border-l-2 border-hairline-strong pl-2 text-body-sm text-ink-2">
        {quote}
      </p>
    </div>
  );
}

export function ConflictPanel({ conflicts, citations = [] }: ConflictPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [drawer, setDrawer] = useState<Citation | null>(null);

  const citationByDoc = new Map(
    citations.map((citation) => [citation.doc_id, citation]),
  );
  const docCount = new Set(
    conflicts.flatMap((conflict) => [conflict.doc_a, conflict.doc_b]),
  ).size;

  return (
    <div className="border-t border-hairline px-4 py-3">
      <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2.5">
        <div className="flex items-start gap-2">
          <IconAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-0.5">
            <p className="text-body-sm font-medium text-ink">
              发现 {docCount} 份文档存在口径差异
            </p>
            <p className="text-body-sm text-ink-2">
              不同文档对同一规则存在不同表述,KnowFlow 不替您选边。
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex items-center gap-1 text-body-sm font-medium text-brand-800 transition-colors duration-150 hover:text-brand-700"
        >
          <IconChevronDown
            className={`size-4 transition-transform duration-150 ${expanded ? "" : "-rotate-90"}`}
          />
          {expanded ? "收起冲突来源" : "查看冲突来源"}
        </button>
        {expanded ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-warning-border pt-2.5">
            {conflicts.map((conflict) => (
              <div
                key={`${conflict.doc_a}-${conflict.doc_b}`}
                className="grid grid-cols-1 gap-2 md:grid-cols-2"
              >
                <ConflictSourceCard
                  docId={conflict.doc_a}
                  quote={conflict.quote_a}
                  citation={citationByDoc.get(conflict.doc_a)}
                  onOpen={setDrawer}
                />
                <ConflictSourceCard
                  docId={conflict.doc_b}
                  quote={conflict.quote_b}
                  citation={citationByDoc.get(conflict.doc_b)}
                  onOpen={setDrawer}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {drawer ? (
        <SourceDrawer citation={drawer} onClose={() => setDrawer(null)} />
      ) : null}
    </div>
  );
}
