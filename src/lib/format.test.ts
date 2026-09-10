import { describe, expect, it } from "vitest";

import { formatAge, versionAgeLabel } from "@/lib/format";

/* 回答版本时间格式化(3.4.4):now 注入保证确定性,不做真实时钟锚定。 */

const NOW = new Date("2026-09-10T12:00:00");

describe("formatAge(上一版回答相对时间)", () => {
  it("<60s → 刚刚", () => {
    expect(formatAge(new Date("2026-09-10T11:59:30"), NOW)).toBe("刚刚");
  });

  it("<1h → N 分钟前", () => {
    expect(formatAge(new Date("2026-09-10T11:55:00"), NOW)).toBe("5 分钟前");
  });

  it("<24h → N 小时前", () => {
    expect(formatAge(new Date("2026-09-10T09:30:00"), NOW)).toBe("2 小时前");
  });

  it("≥24h → 本地日期(YYYY-MM-DD,不随 UTC 偏移)", () => {
    expect(formatAge(new Date("2026-09-08T12:00:00"), NOW)).toBe("2026-09-08");
  });

  it("未来时间按 0 秒计 → 刚刚", () => {
    expect(formatAge(new Date("2026-09-10T12:05:00"), NOW)).toBe("刚刚");
  });
});

describe("versionAgeLabel(最新回答版本标注)", () => {
  it("<60s → 刚刚生成", () => {
    expect(versionAgeLabel(new Date("2026-09-10T11:59:30"), NOW)).toBe("刚刚生成");
  });

  it("≥60s 沿用相对时间口径", () => {
    expect(versionAgeLabel(new Date("2026-09-10T11:55:00"), NOW)).toBe("5 分钟前");
  });
});
