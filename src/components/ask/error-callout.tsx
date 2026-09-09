import { IconInfo } from "@/components/icons";
import { Button } from "@/components/ui/button";

/* inline 错误卡(DesignSystem 问答状态机 ④):danger 图标 + 文案 + 重试 ghost;
   文案来自 BFF 统一错误态(503 不可达 / 504 超时 / 上游 5xx)。 */

export interface ErrorCalloutProps {
  message: string;
  onRetry: () => void;
}

export function ErrorCallout({ message, onRetry }: ErrorCalloutProps) {
  return (
    <section
      aria-label="请求失败"
      role="alert"
      className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-danger-bg px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <IconInfo className="mt-0.5 size-4 shrink-0 text-danger-text" />
        <div>
          <p className="text-body-md font-medium text-danger-text">回答失败</p>
          <p className="mt-0.5 text-body-sm text-ink-2">{message}</p>
        </div>
      </div>
      <Button variant="ghost" size="md" onClick={onRetry} className="shrink-0">
        重试
      </Button>
    </section>
  );
}
