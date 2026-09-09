import { IconInfo } from "@/components/icons";

/* 拒答卡(DesignRules):中性灰 + 发丝线 + 信息图标;
   禁 danger 色、禁感叹号、禁失败动画。
   2026-09-09 人拍板:检索分数/阈值属工程调试信息,不进入主流程
   (保留在 API 响应与 QA 日志,评测页承载检索质量展示);仅保留「依据 0 条」。 */

export function NoAnswerCallout() {
  return (
    <section
      aria-label="未找到答案"
      className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 px-4 py-4"
    >
      <div className="flex items-center gap-2">
        <IconInfo className="size-4 text-ink-3" />
        <h2 className="text-heading-2 font-semibold text-ink">知识库中未找到答案</h2>
      </div>
      <p className="text-body-md text-ink-2">
        当前知识库中没有足够相关的内容来回答这个问题。
      </p>
      <p className="text-numeric text-ink-3">依据 0 条</p>
      <ul className="mt-1 flex flex-col gap-1 text-body-sm text-ink-2">
        <li>· 换个说法再试一次</li>
        <li>· 确认文档已上传到文档库</li>
        <li>· 仍不确定时,联系知识库管理员确认</li>
      </ul>
    </section>
  );
}
