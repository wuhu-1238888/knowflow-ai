/* 检索模式分段切换(DesignSystem:容器 surface-2 + 2px 内边距;激活项 = 白底 + 发丝线 + 微阴影)。 */

export const MODE_OPTIONS = [
  { value: "vector", label: "向量" },
  { value: "hybrid", label: "混合" },
  { value: "hybrid_rerank", label: "混合+重排" },
] as const;

export type AskMode = (typeof MODE_OPTIONS)[number]["value"];

export interface SegmentedProps {
  value: AskMode;
  onChange: (value: AskMode) => void;
}

export function Segmented({ value, onChange }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label="检索模式"
      className="inline-flex items-center gap-0.5 rounded-sm bg-surface-2 p-0.5"
    >
      {MODE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xs px-2.5 py-1 text-body-sm leading-[1.5] transition-colors duration-150 ${
              active
                ? "border border-hairline bg-surface font-medium text-ink shadow-hover"
                : "border border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
