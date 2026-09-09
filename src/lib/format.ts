/* 展示层共用格式化(跨页面,不依赖组件)。 */

/** 上传时间 ISO → 日期(YYYY-MM-DD);空串/非法 → 空串(展示层回退不显示)。 */
export function formatUploadDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "";
}
