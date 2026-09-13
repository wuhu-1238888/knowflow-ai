/* 来源上下文标记(2026-09-13,文档详情页返回逻辑):
   各入口页挂载时向 sessionStorage 写入「最近访问来源」(按标签页隔离、
   刷新不丢、关标签页即清),文档详情页据此决定返回行为:
   - 来源 qa(知识问答)→ router.back() 回到问答页(状态由 ask-state 快照恢复);
   - 来源 docs(文档库)→ router.back() 回到列表(浏览器恢复滚动);
   - 无标记(直接访问/新标签页)→ push 兜底目标。
   仅两种来源,不引入状态管理库。 */

const KEY = "kf:nav:last-source";

export type NavSource = "qa" | "docs";

export function setNavSource(source: NavSource): void {
  try {
    sessionStorage.setItem(KEY, source);
  } catch {
    /* 隐私模式/禁用存储时静默降级:返回走兜底 push */
  }
}

export function getNavSource(): NavSource | null {
  try {
    const value = sessionStorage.getItem(KEY);
    return value === "qa" || value === "docs" ? value : null;
  } catch {
    return null;
  }
}
