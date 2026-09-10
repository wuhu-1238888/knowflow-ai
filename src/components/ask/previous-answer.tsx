"use client";

import { useState } from "react";

import { AnswerSheet } from "@/components/ask/answer-sheet";
import { IconChevronDown } from "@/components/icons";
import { formatAge } from "@/lib/format";
import type { Citation, ConflictItem } from "@/lib/rag";

/* 上一版回答(3.4.4 版本管理):默认折叠,一行轻量头(无渐变点、无徽标、
   次级文字),点击展开后复用 AnswerSheet 的 previous 变体(复制 + 反馈,
   无重新生成;反馈按本版本 qa_id 独立存取,3.4.6)。冲突信息属于该版本,
   随 conflicts 传入 AnswerSheet 的 Trust 层一并呈现,不与最新回答串版本。 */

export interface AnswerVersion {
  qa_id: string;
  answer: string;
  citations: Citation[];
  conflicts: ConflictItem[] | null;
  /** 同一问题内的版本序号(1 起,连续重新生成递增,v1→v2→v3 关系可读)。 */
  version: number;
  createdAt: Date;
}

export interface PreviousAnswerProps {
  version: AnswerVersion;
}

export function PreviousAnswer({ version }: PreviousAnswerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-label="上一版回答" className="rounded-lg border border-hairline">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-1.5 rounded-t-lg px-4 py-3 text-body-sm text-ink-2 transition-colors duration-150 hover:bg-surface-2"
      >
        <IconChevronDown
          className={`size-4 text-ink-3 transition-transform duration-150 ${expanded ? "" : "-rotate-90"}`}
        />
        <span>
          上一版回答 <span className="text-numeric">v{version.version}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span className="text-ink-3">{formatAge(version.createdAt)}</span>
      </button>
      {expanded ? (
        <div className="border-t border-hairline p-3">
          <AnswerSheet
            key={version.qa_id}
            variant="previous"
            frame={false}
            answer={version.answer}
            citations={version.citations}
            conflicts={version.conflicts}
            qaId={version.qa_id}
          />
        </div>
      ) : null}
    </section>
  );
}
