import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* L1 设计 token 一致性对拍:design/DesignSystem.md front matter(单一事实来源)
   vs src/styles/theme.css(@theme 映射)。数值必须 1:1,禁止手改其一不手改其二。 */

const ROOT = process.cwd();
const DESIGN = readFileSync(
  path.join(ROOT, "design", "DesignSystem.md"),
  "utf8",
);
const THEME = readFileSync(path.join(ROOT, "src", "styles", "theme.css"), "utf8");

function frontMatter(): string {
  const m = DESIGN.match(/^---\r?\n([\s\S]*?)\r?\n---/m);
  if (!m) throw new Error("DesignSystem.md 未找到 YAML front matter");
  return m[1];
}

/** 提取 front matter 中某 section 的叶子键值(逐行解析,支持 "quoted" 与裸值 + 行尾注释)。 */
function sectionLeaves(name: string): Record<string, string> {
  const fm = frontMatter();
  const lines = fm.split(/\r?\n/);
  const out: Record<string, string> = {};
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!/^[ \t]/.test(line)) {
      // 列 0 的键:section 头;首次命中目标 section 后,遇下一 section 头即结束
      if (/^[a-z][a-z0-9-]*:/.test(line)) {
        inSection = line.startsWith(`${name}:`);
      }
      continue;
    }
    if (!inSection) continue;
    const quoted = line.match(/^ {2}([a-z0-9-]+):\s*"([^"]*)"/);
    if (quoted) {
      out[quoted[1]] = quoted[2];
      continue;
    }
    const bare = line.match(/^ {2}([a-z0-9-]+):\s*(\S+)/);
    if (bare) out[bare[1]] = bare[2];
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`front matter 未找到 section: ${name}`);
  }
  return out;
}

/** 去掉全部空白后比较,规避 YAML 与 CSS 书写空格差异。 */
function stripWs(s: string): string {
  return s.replace(/\s+/g, "");
}

const THEME_STRIPPED = stripWs(THEME);

describe("L1 token 对拍:colors", () => {
  const colors = sectionLeaves("colors");

  it("colors section 可解析且非空(≥ 30 个 token)", () => {
    expect(Object.keys(colors).length).toBeGreaterThanOrEqual(30);
  });

  it("每个颜色值都在 theme.css 中逐字存在(去空白)", () => {
    const missing: string[] = [];
    for (const [key, value] of Object.entries(colors)) {
      if (!THEME_STRIPPED.includes(stripWs(value))) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});

describe("L1 token 对拍:rounded", () => {
  const rounded = sectionLeaves("rounded");

  it("每个圆角 token 映射为 --radius-*(px)", () => {
    for (const [key, value] of Object.entries(rounded)) {
      if (key === "pill") continue; // 胶囊白名单专用,禁止映射为通用 token
      expect(THEME).toContain(`--radius-${key}: ${value}px;`);
    }
  });

  it("pill 不落库为通用 token(DesignRules 胶囊白名单)", () => {
    expect(THEME).not.toContain("--radius-pill");
  });
});

describe("L1 token 对拍:shadows", () => {
  const shadows = sectionLeaves("shadows");

  it("每个阴影 token 映射为 --shadow-*(值去空白一致)", () => {
    for (const [key, value] of Object.entries(shadows)) {
      const m = THEME.match(new RegExp(`--shadow-${key}:\\s*([^;]+);`));
      expect(m, `theme.css 缺 --shadow-${key}`).toBeTruthy();
      expect(stripWs(m![1])).toBe(stripWs(value));
    }
  });
});

describe("L1 token 对拍:typography 文字阶梯", () => {
  const typo = sectionLeaves("typography");
  const textTokens = Object.keys(typo).filter((k) =>
    /^(display-lg|heading-\d|body-\w+|caption|micro|code-\w+|numeric)$/.test(k),
  );

  it("12 级文字阶梯齐全且都映射为 --text-*", () => {
    expect(textTokens).toHaveLength(12);
    for (const key of textTokens) {
      expect(THEME).toContain(`--text-${key}:`);
    }
  });

  it("font-sans / font-mono 映射为 --font-*", () => {
    expect(THEME).toContain("--font-sans:");
    expect(THEME).toContain("--font-mono:");
  });
});

describe("L1 token 对拍:全局基础样式", () => {
  it("页面底色/主文字/默认字体落在 @layer base", () => {
    expect(THEME).toContain("@layer base");
    expect(THEME).toContain("bg-canvas");
    expect(THEME).toContain("text-ink");
  });

  it("全局焦点环 = 2px brand-600 描边 + 2px 偏移(DesignRules);focus-ring token 供输入框 3px 环", () => {
    expect(THEME).toContain("--color-focus-ring");
    expect(THEME).toMatch(
      /focus-visible[\s\S]*?outline:\s*2px solid var\(--color-brand-600\)/,
    );
    expect(THEME).toMatch(/focus-visible[\s\S]*?outline-offset:\s*2px/);
  });

  it("prefers-reduced-motion 存在(DesignRules 动效预算)", () => {
    expect(THEME).toContain("prefers-reduced-motion");
  });
});
