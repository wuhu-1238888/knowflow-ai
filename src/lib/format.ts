/* 展示层共用格式化(跨页面,不依赖组件)。 */

/** 上传时间 ISO → 日期(YYYY-MM-DD);空串/非法 → 空串(展示层回退不显示)。 */
export function formatUploadDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "";
}

/** 评测运行时间 ISO(UTC)→ 本地 "YYYY-MM-DD HH:MM";非法/空 → 空串(展示层回退不显示)。 */
export function formatEvalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 回答版本相对时间:<60s 刚刚 / <1h N 分钟前 / <24h N 小时前 / 否则日期(YYYY-MM-DD)。
 * now 可注入保证测试确定性(不依赖真实时钟)。 */
export function formatAge(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 1000),
  );
  if (seconds < 60) {
    return "刚刚";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟前`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} 小时前`;
  }
  // 本地日期拼装(不用 toISOString 的 UTC 切片,避免跨时区差一天)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
}

/** 最新回答版本标注:<60s 用「刚刚生成」,其余沿用相对时间口径。 */
export function versionAgeLabel(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 1000),
  );
  return seconds < 60 ? "刚刚生成" : formatAge(from, now);
}
