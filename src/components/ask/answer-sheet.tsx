"use client";

import { useMemo, useState } from "react";

import { CitationChip } from "@/components/ask/citation-chip";
import { EvidenceItem } from "@/components/ask/evidence-item";
import { SourceDrawer } from "@/components/ask/source-drawer";
import {
  IconCopy,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { sendFeedback, type Citation, type FeedbackRating } from "@/lib/rag";

/* AnswerSheet(3.3.2 全量):元信息行 → AI 眉题+正文(引用 chip 内嵌)
   → 依据带(EvidenceItem)→ 操作行(重新生成/复制/有用·无用)。
   双向证据联动:悬停引用 chip ↔ 回答正文引用句(brand-50 底)↔ 依据条目
   (brand-600 描边 + 滚动进入视口);点 chip 或「查看原文」滑出来源抽屉。
   2026-09-09 人拍板:元信息行不暴露检索策略与工程调试值(模式徽标/最高分/耗时),
   仅保留用户价值信息「已基于企业知识库检索 · 依据 n 条」;三模式对比见评测页。
   反馈 FR-12:有用/无用乐观更新,失败静默回退(暂无 Toast 组件,记遗留)。 */

export function formatAnswer(answer: string): string {
  return answer
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\`/g, "")
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, ""))
    .join("\n");
}

/** 将正文拆为渲染段:text 段与 [n] 引用段交错;编号由规则侧映射,
    超出依据带的编号渲染为灰态 missing。 */
export function parseAnswerSegments(
  answer: string,
): { text: string; index: number | null }[] {
  const segments: { text: string; index: number | null }[] = [];
  let last = 0;
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const at = match.index;
    if (at === undefined) {
      continue;
    }
    if (at > last) {
      segments.push({ text: answer.slice(last, at), index: null });
    }
    segments.push({ text: match[0], index: Number(match[1]) });
    last = at + match[0].length;
  }
  if (last < answer.length) {
    segments.push({ text: answer.slice(last), index: null });
  }
  return segments;
}

export interface AnswerSheetProps {
  answer: string;
  citations: Citation[];
  qaId?: string;
  onRegenerate?: () => void;
}

export function AnswerSheet({
  answer,
  citations,
  qaId,
  onRegenerate,
}: AnswerSheetProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<Citation | null>(null);
  const [feedback, setFeedback] = useState<{
    rating: FeedbackRating | null;
    pending: boolean;
  }>({ rating: null, pending: false });

  const formatted = useMemo(() => formatAnswer(answer), [answer]);
  const segments = useMemo(() => parseAnswerSegments(formatted), [formatted]);
  const citationByIndex = useMemo(
    () => new Map(citations.map((citation) => [citation.index, citation])),
    [citations],
  );

  async function submitFeedback(rating: FeedbackRating) {
    if (!qaId || feedback.pending) {
      return;
    }
    const previous = feedback.rating;
    setFeedback({ rating, pending: true });
    try {
      await sendFeedback(qaId, rating);
      setFeedback({ rating, pending: false });
    } catch {
      setFeedback({ rating: previous, pending: false }); // 失败静默回退
    }
  }

  return (
    <section
      aria-label="回答"
      className="rounded-lg border border-hairline bg-surface"
    >
      <div className="border-b border-hairline px-4 py-3">
        {/* 元信息行:依据数用 numeric token(DesignRules「数字」) */}
        <div className="flex flex-wrap items-center gap-2 text-body-sm text-ink-2">
          <span>已基于企业知识库检索</span>
          <span aria-hidden="true">·</span>
          <span>
            依据 <span className="text-numeric">{citations.length}</span> 条
          </span>
        </div>
      </div>
      <div className="px-4 py-4">
        {/* AI 眉题:渐变 8px 圆点(渐变白名单第 2 处)+ micro 标签 */}
        <div className="mb-2 flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-ai-gradient" />
          <span className="text-micro font-medium text-ink-3">AI 回答</span>
        </div>
        <p className="whitespace-pre-line text-body-lg text-ink">
          {segments.map((segment, i) => {
            if (segment.index === null) {
              /* 引用句高亮:紧随其后 chip 被悬停时,brand-50 底(双向联动) */
              const next = segments[i + 1];
              const highlighted =
                next !== undefined &&
                next.index !== null &&
                next.index === activeIndex;
              return (
                <span key={i} className={highlighted ? "rounded-sm bg-brand-50" : undefined}>
                  {segment.text}
                </span>
              );
            }
            const citation = citationByIndex.get(segment.index);
            return (
              <CitationChip
                key={i}
                index={segment.index}
                missing={citation === undefined}
                active={activeIndex === segment.index}
                onHover={setActiveIndex}
                onClick={() => {
                  if (citation) {
                    setDrawer(citation);
                  }
                }}
              />
            );
          })}
        </p>
      </div>
      {citations.length > 0 ? (
        <div className="border-t border-hairline px-4 py-3">
          <h2 className="mb-2 text-heading-3 font-medium text-ink">
            依据与来源({citations.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {citations.map((citation) => (
              <EvidenceItem
                key={citation.chunk_id}
                citation={citation}
                active={activeIndex === citation.index}
                onHover={setActiveIndex}
                onOpen={setDrawer}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1 border-t border-hairline px-4 py-2.5">
        <Button variant="secondary" size="md" onClick={onRegenerate}>
          <IconRefresh className="size-4" />
          重新生成
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            void navigator.clipboard?.writeText(answer);
          }}
        >
          <IconCopy className="size-4" />
          复制回答
        </Button>
        <span className="ml-2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="md"
            aria-pressed={feedback.rating === "useful"}
            disabled={feedback.pending}
            onClick={() => void submitFeedback("useful")}
            className={feedback.rating === "useful" ? "text-brand-800" : ""}
          >
            <IconThumbUp className="size-4" />
            有用
          </Button>
          <Button
            variant="ghost"
            size="md"
            aria-pressed={feedback.rating === "useless"}
            disabled={feedback.pending}
            onClick={() => void submitFeedback("useless")}
            className={feedback.rating === "useless" ? "text-brand-800" : ""}
          >
            <IconThumbDown className="size-4" />
            无用
          </Button>
        </span>
      </div>
      {drawer ? (
        <SourceDrawer citation={drawer} onClose={() => setDrawer(null)} />
      ) : null}
    </section>
  );
}
