"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CitationChip } from "@/components/ask/citation-chip";
import { ConflictPanel } from "@/components/ask/conflict-panel";
import { EvidenceItem } from "@/components/ask/evidence-item";
import { SourceDrawer } from "@/components/ask/source-drawer";
import {
  IconCopy,
  IconInfo,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  getFeedback,
  sendFeedback,
  type Citation,
  type ConflictItem,
  type FeedbackRating,
} from "@/lib/rag";

/* AnswerSheet(3.3.2 全量):元信息行 → AI 眉题+正文(引用 chip 内嵌)
   → 依据带(EvidenceItem)→ 操作行(重新生成/复制/有用·无用)。
   双向证据联动:悬停引用 chip ↔ 回答正文引用句(brand-50 底)↔ 依据条目
   (brand-600 描边 + 滚动进入视口);点 chip 或「查看原文」滑出来源抽屉。
   2026-09-09 人拍板:元信息行不暴露检索策略与工程调试值(模式徽标/最高分/耗时),
   仅保留用户价值信息「已基于企业知识库检索 · 依据 n 条」;三模式对比见评测页。
   版本管理(3.4.4):variant latest = 主卡(「AI 回答 · 最新」+ 版本标注 +
   完整操作行);previous = 历史版本(「上一版回答」,复制+反馈、无重新生成,
   边框由外层折叠容器提供);generating = 卡内加载态(重新生成中,真实单请求
   单文案,不伪造多阶段,无操作行 → 失效版本不可反馈);sameNotice = 新旧内容
   一致提示(不复制旧卡片伪装新结果)。
   冲突 Trust 层(3.4.5):conflicts 非空时在正文之后、依据与来源之前渲染
   ConflictPanel(默认轻量提示,可展开来源);冲突随版本传入、不串版本。
   操作反馈(3.4.6):有用/无用 = 互斥选中态(bg-brand-50 + 深蓝文字),重复点击
   同一项不重复提交;pending 禁用防重复点击;失败恢复原状态 + 轻量提示
   「反馈提交失败,请重试」(3s 自动消失,技术细节只进 console)。复制回答 =
   基于真实 Clipboard API 结果反馈:「✓ 已复制」/「复制失败,请重试」1.8s 后
   恢复;复制内容 = AI 回答原文(不改既有复制数据契约)。反馈按 qa_id 绑定
   Answer Version,挂载时 GET 恢复持久化状态(刷新不丢,读取失败静默;
   恢复期间不锁定按钮,用户已提交则以用户提交为准)。 */

/** 复制/失败反馈展示时长(1.5–2s 口径)与反馈失败提示时长。 */
const COPY_FEEDBACK_MS = 1800;
const FEEDBACK_ERROR_MS = 3000;

type CopyState = "idle" | "copied" | "failed";

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
  /* 版本管理(3.4.4):latest 主卡 / previous 历史版本(弱化:复制+反馈,无重新生成)。 */
  variant?: "latest" | "previous";
  /** 眉题右侧轻量版本信息(如「v2 · 刚刚生成」),仅 latest 使用。 */
  versionMeta?: string;
  /** 重新生成中:卡片内容替换为加载态(旧内容在状态机中保留,失败可恢复)。 */
  generating?: boolean;
  /** 本次重新生成结果与上一版一致:明确提示,不复制旧卡片伪装新结果。 */
  sameNotice?: boolean;
  /** 外层边框;previous 折叠容器自带边框时关闭(默认开)。 */
  frame?: boolean;
  /** 本版本的冲突(Trust 层):非空时渲染在正文与依据之间(3.4.5)。 */
  conflicts?: ConflictItem[] | null;
}

export function AnswerSheet({
  answer,
  citations,
  qaId,
  onRegenerate,
  variant = "latest",
  versionMeta,
  generating = false,
  sameNotice = false,
  frame = true,
  conflicts = null,
}: AnswerSheetProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<Citation | null>(null);
  const [feedback, setFeedback] = useState<{
    rating: FeedbackRating | null;
    pending: boolean;
    error: boolean;
  }>({ rating: null, pending: false, error: false });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 用户在恢复读取完成前已提交反馈 → 忽略读取结果(用户最新意图优先,
     避免过期状态覆盖新提交);读取期间不锁定按钮,无禁用闪烁。 */
  const interactedRef = useRef(false);

  const formatted = useMemo(() => formatAnswer(answer), [answer]);
  const segments = useMemo(() => parseAnswerSegments(formatted), [formatted]);
  const citationByIndex = useMemo(
    () => new Map(citations.map((citation) => [citation.index, citation])),
    [citations],
  );

  /* 挂载时恢复该 Answer Version 的持久化反馈(3.4.6:刷新/展开上一版不丢状态);
     读取失败静默(保持未选中,不阻塞主流程);生成中不读取(无操作行)。 */
  useEffect(() => {
    if (!qaId || generating) {
      return;
    }
    let cancelled = false;
    void getFeedback(qaId)
      .then((rating) => {
        if (!cancelled && !interactedRef.current) {
          setFeedback((current) =>
            current.rating === rating ? current : { ...current, rating },
          );
        }
      })
      .catch(() => {
        /* 读取失败静默:按钮以未选中呈现 */
      });
    return () => {
      cancelled = true;
    };
  }, [qaId, generating]);

  /* 卸载时清理复制/错误提示的定时器(避免卸载后 setState)。 */
  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
      }
    };
  }, []);

  async function submitFeedback(rating: FeedbackRating) {
    // 无 qaId 不发请求;pending(提交中)防重复;同一项已选中 → 保持状态、不重复提交(MVP 不支持取消)
    if (!qaId || feedback.pending || feedback.rating === rating) {
      return;
    }
    interactedRef.current = true;
    const previous = feedback.rating;
    setFeedback({ rating: previous, pending: true, error: false });
    try {
      await sendFeedback(qaId, rating);
      setFeedback({ rating, pending: false, error: false });
    } catch (error) {
      // 恢复原状态 + 轻量提示;技术细节只进 console,不暴露给用户
      console.warn("反馈提交失败:", error);
      setFeedback({ rating: previous, pending: false, error: true });
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
      }
      errorTimer.current = setTimeout(() => {
        setFeedback((current) => ({ ...current, error: false }));
      }, FEEDBACK_ERROR_MS);
    }
  }

  async function copyAnswer() {
    // 复制内容 = AI 回答原文(不改既有复制数据契约)
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyState("failed");
      scheduleCopyReset();
      return;
    }
    try {
      await navigator.clipboard.writeText(answer);
      setCopyState("copied");
    } catch (error) {
      // 技术错误(NotAllowedError 等)只进 console,给用户可读失败反馈
      console.warn("复制回答失败:", error);
      setCopyState("failed");
    }
    scheduleCopyReset();
  }

  function scheduleCopyReset() {
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
  }

  const isLatest = variant === "latest";

  return (
    <section
      aria-label="回答"
      className={frame ? "rounded-lg border border-hairline bg-surface" : ""}
    >
      {generating ? (
        <>
          <div className="border-b border-hairline px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-ai-gradient" />
              <span className="text-micro font-medium text-ink-3">AI 回答</span>
              <span className="text-caption text-ink-3">正在重新生成</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 px-4 py-4">
            <p className="text-body-md text-ink-2">正在重新生成回答…</p>
            <p className="text-caption text-ink-3">正在检索企业知识库并生成回答</p>
          </div>
        </>
      ) : (
        <>
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
          {sameNotice ? (
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <IconInfo className="size-4 text-ink-3" />
              <p className="text-body-sm text-ink-2">
                已完成重新生成,本次回答与上一版一致。
              </p>
            </div>
          ) : null}
          <div className="px-4 py-4">
            {/* AI 眉题:渐变 8px 圆点(渐变白名单第 2 处)+ micro 标签 + 版本标注 */}
            <div className="mb-2 flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-ai-gradient" />
              <span className="text-micro font-medium text-ink-3">
                {isLatest ? "AI 回答" : "上一版回答"}
              </span>
              {isLatest ? (
                <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-caption text-brand-800">
                  最新
                </span>
              ) : null}
              {versionMeta ? (
                <span className="ml-auto text-caption text-ink-3">{versionMeta}</span>
              ) : null}
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
          {/* 冲突 Trust 层(3.4.5):正文之后、依据与来源之前;轻量提示默认收起 */}
          {conflicts && conflicts.length > 0 ? (
            <ConflictPanel conflicts={conflicts} citations={citations} />
          ) : null}
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
            {isLatest ? (
              <Button variant="secondary" size="md" onClick={onRegenerate}>
                <IconRefresh className="size-4" />
                重新生成
              </Button>
            ) : null}
            {/* 复制回答(3.4.6):仅真实 Clipboard 成功后反馈「✓ 已复制」,失败可读提示,
                1.8s 自动恢复;复制内容 = 本版本回答原文(与 latest/previous 无关)。
                状态色用 data 属性变体(特异性高于 ghost 基础色,不依赖类顺序) */}
            <Button
              variant="ghost"
              size="md"
              data-copied={copyState === "copied" ? "true" : undefined}
              data-failed={copyState === "failed" ? "true" : undefined}
              onClick={() => void copyAnswer()}
              className="data-[copied=true]:text-success-text data-[failed=true]:text-danger-text"
            >
              {copyState === "idle" ? <IconCopy className="size-4" /> : null}
              {copyState === "idle"
                ? "复制回答"
                : copyState === "copied"
                  ? "✓ 已复制"
                  : "复制失败,请重试"}
            </Button>
            {/* 有用/无用(3.4.6):互斥选中(浅蓝底 + 深蓝字),重复点击同一项
                不重复提交;pending 禁用防重复点击;失败恢复原状态 + 轻量提示。
                选中样式用 aria-pressed 变体:属性选择器特异性高于 ghost 的
                bg-transparent/text-ink-2,保证选中态必然生效(修复 2026-09-11)。 */}
            <span className="ml-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="md"
                aria-pressed={feedback.rating === "useful"}
                disabled={feedback.pending}
                onClick={() => void submitFeedback("useful")}
                className="aria-pressed:bg-brand-50 aria-pressed:text-brand-800 aria-pressed:hover:bg-brand-100"
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
                className="aria-pressed:bg-brand-50 aria-pressed:text-brand-800 aria-pressed:hover:bg-brand-100"
              >
                <IconThumbDown className="size-4" />
                无用
              </Button>
              {feedback.error ? (
                <span className="ml-1 text-caption text-danger-text" aria-live="polite">
                  反馈提交失败,请重试
                </span>
              ) : null}
            </span>
          </div>
        </>
      )}
      {drawer ? (
        <SourceDrawer citation={drawer} onClose={() => setDrawer(null)} />
      ) : null}
    </section>
  );
}
