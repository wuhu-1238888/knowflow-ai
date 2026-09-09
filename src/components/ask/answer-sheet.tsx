import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconFiles } from "@/components/icons";
import type { Citation } from "@/lib/rag";
import type { AskMode } from "./segmented";

/* AnswerSheet(3.3.2 最小切片):元信息行 → AI 眉题+正文 → 依据带 → 复制操作。
 * 双向证据联动 / CitationChip 悬停 / SourceDrawer / 重新生成 / 有用·无用 = 3.3.2 全量补齐。
 * 回答正文轻量清洗 markdown 符号(加粗、行内代码、标题 #)后按行保留——真实 provider 的富文本渲染后续决定。 */

const MODE_BADGE: Record<AskMode, "mode-vector" | "mode-hybrid" | "mode-hybrid"> = {
  vector: "mode-vector",
  hybrid: "mode-hybrid",
  hybrid_rerank: "mode-hybrid",
};

export function formatAnswer(answer: string): string {
  return answer
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\`/g, "")
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, ""))
    .join("\n");
}

export interface AnswerSheetProps {
  answer: string;
  citations: Citation[];
  confidence: number;
  mode: AskMode;
  elapsedMs: number;
}

export function AnswerSheet({ answer, citations, confidence, mode, elapsedMs }: AnswerSheetProps) {
  return (
    <section
      aria-label="回答"
      className="rounded-lg border border-hairline bg-surface"
    >
      <div className="border-b border-hairline px-4 py-3">
        {/* 元信息行:分数与数量一律 numeric token(DesignRules「数字」) */}
        <div className="flex flex-wrap items-center gap-2 text-numeric text-ink-2">
          <Badge variant={MODE_BADGE[mode]}>{mode === "hybrid_rerank" ? "混合+重排" : mode === "hybrid" ? "混合" : "向量"}</Badge>
          <span>依据 {citations.length} 条</span>
          <span aria-hidden="true">·</span>
          <span>最高分 {confidence.toFixed(2)}</span>
          <span aria-hidden="true">·</span>
          <span>耗时 {(elapsedMs / 1000).toFixed(1)}s</span>
        </div>
      </div>
      <div className="px-4 py-4">
        {/* AI 眉题:渐变 8px 圆点(渐变白名单第 2 处)+ micro 标签 */}
        <div className="mb-2 flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-ai-gradient" />
          <span className="text-micro font-medium text-ink-3">AI 回答</span>
        </div>
        <p className="whitespace-pre-line text-body-lg text-ink">
          {formatAnswer(answer)}
        </p>
      </div>
      {citations.length > 0 ? (
        <div className="border-t border-hairline px-4 py-3">
          <h2 className="mb-2 text-heading-3 font-medium text-ink">
            依据与来源({citations.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {citations.map((citation) => (
              <li key={citation.chunk_id} className="flex gap-2 text-body-sm">
                <span className="mt-0.5 shrink-0 text-numeric text-brand-800">
                  [{citation.index}]
                </span>
                <div className="min-w-0">
                  <p className="text-ink">{citation.quote}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-caption text-ink-3">
                    <IconFiles className="size-4" />
                    <span className="truncate">
                      {citation.doc_id} / {citation.chunk_id}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="border-t border-hairline px-4 py-2.5">
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            void navigator.clipboard?.writeText(answer);
          }}
        >
          复制回答
        </Button>
      </div>
    </section>
  );
}
