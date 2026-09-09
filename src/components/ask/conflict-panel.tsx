import { Badge } from "@/components/ui/badge";
import type { ConflictItem } from "@/lib/rag";

/* 冲突面板(DesignRules):warning 徽标 + 等宽等权双卡,并列呈现不选边;
   禁 danger 色、禁胜负标记;<768px 纵向堆叠。 */

export interface ConflictPanelProps {
  conflicts: ConflictItem[];
}

export function ConflictPanel({ conflicts }: ConflictPanelProps) {
  return (
    <section
      aria-label="文档口径冲突"
      className="rounded-lg border border-warning-border bg-surface px-4 py-4"
    >
      <div className="mb-1 flex items-center gap-2">
        <Badge variant="warning">口径不一致</Badge>
      </div>
      <p className="text-body-md text-ink-2">
        以下文档对同一问题的表述不一致,KnowFlow 不替您选边。
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {conflicts.map((conflict, index) => (
          <div key={`${conflict.doc_a}-${conflict.doc_b}`} className="flex flex-col gap-1">
            <div
              className="rounded-md border border-hairline bg-surface p-3"
              aria-label={`来源 ${index + 1}`}
            >
              <p className="mb-1 text-heading-3 font-medium text-ink">{conflict.doc_a}</p>
              <p className="text-body-sm text-ink-2">{conflict.quote_a}</p>
            </div>
            <div
              className="rounded-md border border-hairline bg-surface p-3"
              aria-label={`来源 ${index + 2}`}
            >
              <p className="mb-1 text-heading-3 font-medium text-ink">{conflict.doc_b}</p>
              <p className="text-body-sm text-ink-2">{conflict.quote_b}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
