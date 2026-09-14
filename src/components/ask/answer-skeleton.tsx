/* 等待态 Skeleton(2026-09-14):模拟真实回答卡结构——元信息行 → 正文
   (AI 眉题 + 2~3 行文本)→ 依据与来源(标题 + 来源卡占位)→ 操作行,
   与 AnswerSheet 同边框、同内边距,完成切换无布局跳动。
   全部中性灰阶(surface-2 脉动),无紫色渐变、无 shimmer 特效;
   DesignSystem:内容区禁止旋转加载图标(仅按钮内 16px 细环允许),
   Skeleton 只做结构占位,「处理中」指示由「AI 生成中」胶囊承担。
   2026-09-14 人拍板回调:等待文案(胶囊 + 话术 + 冷启动提示)位于
   骨架卡**上方**(与卡片左边缘对齐、左对齐排版),不在卡内——
   本组件只渲染骨架卡,文案由页面状态机渲染在卡外同一容器。 */

const BAR = "animate-skeleton rounded-sm bg-surface-2";

export function AnswerSkeleton() {
  return (
    <section
      aria-label="正在生成回答"
      role="status"
      className="rounded-lg border border-hairline bg-surface"
    >
      {/* 元信息行占位(已基于企业知识库检索 · 依据 n 条) */}
      <div className="border-b border-hairline px-4 py-3">
        <div className={`${BAR} h-3 w-56`} />
      </div>
      {/* 正文区占位:AI 眉题 + 2~3 行回答文本 */}
      <div className="px-4 py-4">
        <div className="mb-2.5 flex items-center gap-1.5">
          <div className={`${BAR} h-2.5 w-16`} />
          <div className={`${BAR} ml-auto h-2.5 w-20`} />
        </div>
        <div className="flex flex-col gap-2">
          <div className={`${BAR} h-3.5 w-full`} />
          <div className={`${BAR} h-3.5 w-11/12`} />
          <div className={`${BAR} h-3.5 w-2/3`} />
        </div>
      </div>
      {/* 依据与来源占位:标题 + 2 个来源卡 */}
      <div className="border-t border-hairline px-4 py-3">
        <div className={`${BAR} mb-2.5 h-4 w-28`} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5 rounded-sm border border-hairline px-3 py-2.5">
            <div className={`${BAR} h-3 w-40`} />
            <div className={`${BAR} h-2.5 w-full`} />
            <div className={`${BAR} h-2.5 w-3/4`} />
          </div>
          <div className="flex flex-col gap-1.5 rounded-sm border border-hairline px-3 py-2.5">
            <div className={`${BAR} h-3 w-48`} />
            <div className={`${BAR} h-2.5 w-11/12`} />
          </div>
        </div>
      </div>
      {/* 操作行占位(重新生成/复制/有用·无用) */}
      <div className="flex gap-1.5 border-t border-hairline px-4 py-2.5">
        <div className={`${BAR} h-6 w-20`} />
        <div className={`${BAR} h-6 w-20`} />
        <div className={`${BAR} ml-2 h-6 w-24`} />
      </div>
    </section>
  );
}
