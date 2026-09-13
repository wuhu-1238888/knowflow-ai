import type { AnswerVersion } from "@/components/ask/previous-answer";
import type { AskResponse } from "@/lib/rag";

/* 会话历史「最近问过」(2026-09-13 闭环优化,规格 9):
   仅当前会话内存快照(无账号体系、不落盘);每次提问/重新生成完成后 upsert
   该问题的结果快照(回答/拒答/上一版/一致提示),最近的在最前,上限 6 条;
   点击回看已存答案(纯状态恢复,不发新请求)。 */

export interface HistoryEntry {
  query: string;
  latest: AnswerVersion | null;
  previous: AnswerVersion | null;
  refusal: AskResponse | null;
  sameNotice: boolean;
}

export interface RecentQuestionsProps {
  items: HistoryEntry[];
  /** 当前结果区对应的问题(用于选中态)。 */
  activeQuery: string;
  onSelect: (entry: HistoryEntry) => void;
}

export function RecentQuestions({
  items,
  activeQuery,
  onSelect,
}: RecentQuestionsProps) {
  return (
    <section aria-label="最近问过" className="flex flex-col gap-2">
      <h2 className="text-caption font-medium text-ink-3">最近问过</h2>
      <ul className="flex flex-col gap-1">
        {items.map((entry) => {
          const active = entry.query === activeQuery;
          return (
            <li key={entry.query}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                aria-pressed={active}
                className={`w-full truncate rounded-md border px-3 py-2 text-left text-body-sm transition-colors duration-150 ${
                  active
                    ? "border-brand-600 bg-brand-50 text-ink"
                    : "border-hairline bg-surface text-ink-2 hover:bg-surface-2"
                }`}
              >
                {entry.query}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
