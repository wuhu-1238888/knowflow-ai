/* 文档详情页 Chunk 展示格式化(2026-09-13 闭环优化,规格 4.3):
   纯函数模块——Next.js App Router 页面文件只允许导出 default/config 等白名单,
   辅助函数独立于此,供详情页与测试共用。 */

/** 从 chunk 文本提取第一个 Markdown 标题作「标题/章节」;无标题 → null(UI 回退首行)。 */
export function chunkHeading(text: string): string | null {
  const match = text.match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** 无标题 chunk 的回退摘要:首个非空行,超 24 字截断。 */
export function chunkFallbackTitle(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  const trimmed = firstLine.trim();
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}

/** 文本摘要:折叠空白后取前 120 字,超长加省略号。 */
export function chunkSummary(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}
