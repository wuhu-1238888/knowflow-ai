"use client";

/* QuestionChip(3.5.1 补齐):示例问题 chip——白底 + 发丝线,悬停 surface-2,
   点击填入提问框并直接提交;内容来自评测集 query。
   按 DesignSystem components.question-chip 规格映射:
   height 28 / padding 5px 10px / body-sm ink-2 / rounded.sm,
   悬停 = surface-2 底 + hairline-strong 描边(question-chip-hover)。
   替换 3.3.2 以 Button secondary 充当的临时实现(偏差记录②兑现)。 */

export function QuestionChip({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className="inline-flex h-7 items-center rounded-sm border border-hairline bg-surface px-2.5 py-[5px] text-body-sm text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-2"
    >
      {label}
    </button>
  );
}
