# 设计系统(Design System)

> 版本:v0.1 | 最后更新:2026-09-09
> 对应阶段:Stage 09 设计系统
> 纪律:token 全部放在本文档 YAML front matter = 单一事实来源;代码全部映射 front matter,禁止硬编码偏离值。DesignRules.md 定义「必须做/禁止做」,本文档定义「系统是什么」。

---

colors:
  # ── 品牌与 AI 强调色 ──
  brand-600: "#5B5BD6"          # 知流靛蓝:唯一品牌强调色(主按钮/链接/激活态/AI 标识/引用)
  brand-700: "#4949C4"          # hover
  brand-800: "#3B3BAD"          # pressed / 深色文字变体(引用 chip 文字)
  brand-100: "#ECEBFF"          # 6% 淡紫底(选中项/引用 chip 底/证据高亮底)
  brand-50:  "#F6F6FF"          # 更浅底(回答中引用句高亮)
  focus-ring: "rgba(91,91,214,0.25)"   # 焦点环(2px)
  # ── AI 渐变(白名单:仅品牌标记/AI 眉题点/生成中胶囊) ──
  ai-gradient: "linear-gradient(135deg, #5B5BD6 0%, #8B7CF0 100%)"
  # ── 中性色 ──
  canvas: "#F6F6F8"             # 页面底色(近白偏冷灰)
  surface: "#FFFFFF"            # 卡片/面板(白浮于灰)
  surface-2: "#F0F1F4"          # 次级表面(表头/嵌套区/代码底/禁用底)
  hairline: "#E7E8EC"           # 分隔线/卡片描边
  hairline-strong: "#D8D9E0"    # 输入框描边/次级按钮描边
  ink: "#18181B"                # 主文字
  ink-2: "#52525B"              # 次级文字
  ink-3: "#71717A"              # 辅助文字/元信息(对白底对比度 ≥ 4.5:1)
  ink-disabled: "#A1A1AB"       # 禁用文字/占位符
  ink-inverse: "#FFFFFF"        # 深色/彩色底上的文字
  overlay: "rgba(24,24,27,0.32)"    # 模态遮罩
  overlay-light: "rgba(24,24,27,0.16)" # 来源抽屉遮罩
  # ── 语义色 ──
  success: "#16A34A"            # 成功图标/对勾
  success-text: "#15803D"       # 成功文字(对 success-bg 对比度 ≥ 4.5:1)
  success-bg: "#E9F7EF"
  warning: "#B45309"            # 冲突/分歧(文字与图标)
  warning-bg: "#FBF3E2"
  warning-border: "#E9D5A0"     # 冲突面板边框(琥珀浅档)
  danger: "#DC2626"             # 危险图标
  danger-text: "#B91C1C"        # 危险文字(对 danger-bg 对比度 ≥ 4.5:1)
  danger-bg: "#FDECEC"
  info: "#2563EB"
  info-bg: "#EAF2FD"
  # ── 检索模式/来源徽标(固定语义,禁止换用) ──
  mode-keyword: "#475569"       # 关键词检索:石板
  mode-keyword-bg: "#EFF1F4"
  mode-vector: "#0E7490"        # 向量检索:青
  mode-vector-bg: "#E7F4F6"
  mode-hybrid: "#3B3BAD"        # 混合检索:靛蓝(brand 深档)
  mode-hybrid-bg: "#ECEBFF"
typography:
  font-sans: "Inter, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
  font-mono: "'Geist Mono', 'JetBrains Mono', Consolas, 'SF Mono', monospace"
  display-lg: { size: 28, weight: 600, lineHeight: 1.35, letterSpacing: -0.02em }   # 页面标题
  heading-1:  { size: 20, weight: 600, lineHeight: 1.4,  letterSpacing: -0.01em }   # 分区标题
  heading-2:  { size: 16, weight: 600, lineHeight: 1.5,  letterSpacing: 0 }         # 小节/卡片标题
  heading-3:  { size: 14, weight: 600, lineHeight: 1.5,  letterSpacing: 0 }         # 证据卡标题/表头分组
  body-lg:    { size: 16, weight: 400, lineHeight: 1.7,  letterSpacing: 0 }         # 阅读正文(回答正文/文档原文)
  body-md:    { size: 15, weight: 400, lineHeight: 1.6,  letterSpacing: 0 }         # 默认 UI 文本
  body-sm:    { size: 13, weight: 400, lineHeight: 1.5,  letterSpacing: 0 }         # 表格/次级文本
  caption:    { size: 12, weight: 400, lineHeight: 1.5,  letterSpacing: 0 }         # 说明/元信息
  micro:      { size: 11, weight: 500, lineHeight: 1.4,  letterSpacing: 0.04em }    # 眉题(eyebrow)
  code-md:    { size: 13, weight: 400, lineHeight: 1.6, fontFamily: font-mono }     # 内联代码/ID
  code-sm:    { size: 12, weight: 400, lineHeight: 1.5, fontFamily: font-mono }     # 表格内代码
  numeric:    { size: 13, weight: 400, lineHeight: 1.5, fontFamily: font-mono, fontVariantNumeric: tabular-nums } # 数字单元格/分数/耗时
spacing:
  px: 2        # 细间距
  s1: 4
  s2: 8
  s3: 12
  s4: 16
  s5: 20
  s6: 24
  s8: 32
  s10: 40
  s12: 48
rounded:
  xs: 4       # 内联代码
  sm: 6       # 控件:按钮/输入框/徽标/引用 chip/导航项
  md: 8       # 表格容器/小卡
  lg: 10      # 卡片/回答页/依据条目/抽屉内容区
  xl: 12      # 抽屉/模态/弹层
  pill: 999   # 白名单:仅「AI 生成中」状态胶囊
shadows:
  hover: "0 1px 2px rgba(24,24,27,0.05)"                                  # 悬停微抬
  floating: "0 8px 24px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.04)" # 抽屉/模态/Toast
motion:
  fast: "150ms ease-out"     # hover/焦点/颜色/背景
  medium: "200ms ease-out"   # 抽屉滑入/手风琴展开
  shimmer: "1.6s linear infinite"  # 仅「AI 生成中」胶囊呼吸动画
components:
  # ── 按钮 ──
  button-primary:      { backgroundColor: "{colors.brand-600}", textColor: "{colors.ink-inverse}", typography: { size: 14, weight: 500, lineHeight: 1.3 }, rounded: "{rounded.sm}", padding: "8px 14px", height: 36 }
  button-primary-hover:   { backgroundColor: "{colors.brand-700}" }
  button-primary-pressed: { backgroundColor: "{colors.brand-800}" }
  button-primary-disabled:{ backgroundColor: "{colors.surface-2}", textColor: "{colors.ink-disabled}" }
  button-secondary:    { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", border: "1px solid {colors.hairline-strong}", rounded: "{rounded.sm}", typography: { size: 14, weight: 500, lineHeight: 1.3 }, padding: "8px 14px", height: 36 }
  button-secondary-hover: { backgroundColor: "{colors.surface-2}" }
  button-ghost:        { backgroundColor: "transparent", textColor: "{colors.ink-2}", rounded: "{rounded.sm}", typography: { size: 14, weight: 400, lineHeight: 1.3 }, padding: "8px 12px", height: 36 }
  button-ghost-hover:  { backgroundColor: "{colors.surface-2}" }
  button-danger:       { backgroundColor: "{colors.danger}", textColor: "{colors.ink-inverse}", rounded: "{rounded.sm}", typography: { size: 14, weight: 500, lineHeight: 1.3 }, padding: "8px 14px", height: 36 }
  button-icon:         { backgroundColor: "transparent", textColor: "{colors.ink-2}", rounded: "{rounded.sm}", size: 32, hover: "{colors.surface-2}" }
  link:                { textColor: "{colors.brand-600}", typography: "inherit", underline: "hover-only" }
  # ── 输入 ──
  text-input:          { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", border: "1px solid {colors.hairline-strong}", rounded: "{rounded.sm}", padding: "8px 12px", height: 40, typography: "{typography.body-md}", placeholder: "{colors.ink-disabled}" }
  text-input-focused:  { border: "1px solid {colors.brand-600}", boxShadow: "0 0 0 3px {colors.focus-ring}" }
  text-input-error:    { border: "1px solid {colors.danger}", boxShadow: "0 0 0 3px rgba(220,38,38,0.15)" }
  ask-textarea:        { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", border: "1px solid {colors.hairline-strong}", rounded: "{rounded.lg}", padding: "12px 14px", minHeight: 96, typography: "{typography.body-lg}" }
  # ── 检索模式切换(分段控件) ──
  segmented:           { backgroundColor: "{colors.surface-2}", rounded: "{rounded.sm}", padding: 2, height: 32 }
  segmented-item:      { textColor: "{colors.ink-3}", typography: "{typography.body-sm}", padding: "4px 10px" }
  segmented-item-active:{ backgroundColor: "{colors.surface}", textColor: "{colors.ink}", border: "1px solid {colors.hairline}", boxShadow: "{shadows.hover}" }
  # ── 徽标 ──
  badge-base:          { rounded: "{rounded.sm}", padding: "2px 8px", typography: "{typography.caption}", height: 22 }
  badge-neutral:       { backgroundColor: "{colors.surface-2}", textColor: "{colors.ink-2}" }
  badge-success:       { backgroundColor: "{colors.success-bg}", textColor: "{colors.success-text}" }
  badge-info:          { backgroundColor: "{colors.info-bg}", textColor: "{colors.info}" }
  badge-danger:        { backgroundColor: "{colors.danger-bg}", textColor: "{colors.danger-text}" }
  badge-warning:       { backgroundColor: "{colors.warning-bg}", textColor: "{colors.warning}" }
  badge-mode-keyword:  { backgroundColor: "{colors.mode-keyword-bg}", textColor: "{colors.mode-keyword}" }
  badge-mode-vector:   { backgroundColor: "{colors.mode-vector-bg}", textColor: "{colors.mode-vector}" }
  badge-mode-hybrid:   { backgroundColor: "{colors.mode-hybrid-bg}", textColor: "{colors.mode-hybrid}" }
  # ── 卡片与表格 ──
  card:                { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", rounded: "{rounded.lg}", padding: "{spacing.s6}" }
  table-container:     { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", rounded: "{rounded.md}", overflow: "hidden" }
  table-header-cell:   { backgroundColor: "{colors.surface-2}", textColor: "{colors.ink-2}", typography: "{typography.caption}", padding: "10px 12px" }
  table-cell:          { textColor: "{colors.ink}", typography: "{typography.body-sm}", padding: "12px", borderBottom: "1px solid {colors.hairline}" }
  table-row-hover:     { backgroundColor: "{colors.surface-2}" }
  # ── 应用外壳 ──
  sidebar:             { backgroundColor: "{colors.surface}", borderRight: "1px solid {colors.hairline}", width: 224 }
  sidebar-item:        { textColor: "{colors.ink-2}", typography: "{typography.body-md}", rounded: "{rounded.sm}", height: 36, padding: "0 10px" }
  sidebar-item-hover:  { backgroundColor: "{colors.surface-2}" }
  sidebar-item-active: { backgroundColor: "{colors.brand-100}", textColor: "{colors.brand-800}", typography: { size: 15, weight: 500, lineHeight: 1.6 } }
  # ── 浮层 ──
  drawer:              { backgroundColor: "{colors.surface}", boxShadow: "{shadows.floating}", width: 360, rounded: "{rounded.xl}" }
  modal:               { backgroundColor: "{colors.surface}", boxShadow: "{shadows.floating}", rounded: "{rounded.xl}", maxWidth: 420 }
  toast:               { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", boxShadow: "{shadows.floating}", rounded: "{rounded.lg}", padding: "10px 14px" }
  # ── AI 与知识特有组件 ──
  answer-sheet:        { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", rounded: "{rounded.lg}", padding: "{spacing.s6}" }
  answer-sheet-meta:   { textColor: "{colors.ink-3}", typography: "{typography.caption}", numeric: "{typography.numeric}" }
  ai-eyebrow:          { textColor: "{colors.ink-3}", typography: "{typography.micro}", dot: { size: 8, background: "{colors.ai-gradient}", rounded: "{rounded.pill}" } }
  citation-chip:       { backgroundColor: "{colors.brand-100}", textColor: "{colors.brand-800}", typography: "{typography.code-sm}", rounded: "{rounded.sm}", padding: "1px 6px", height: 22, hitArea: 32 }
  citation-chip-hover: { backgroundColor: "{colors.brand-600}", textColor: "{colors.ink-inverse}" }
  citation-quote-highlight: { backgroundColor: "{colors.brand-50}", transition: "background {motion.fast}" }
  evidence-item:       { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", rounded: "{rounded.lg}", padding: "{spacing.s4}" }
  evidence-item-highlight: { border: "1px solid {colors.brand-600}", backgroundColor: "{colors.brand-50}" }
  evidence-quote:      { backgroundColor: "{colors.surface-2}", borderLeft: "2px solid {colors.brand-100}", padding: "{spacing.s2} {spacing.s3}", typography: "{typography.body-sm}", textColor: "{colors.ink-2}" }
  no-answer-callout:   { backgroundColor: "{colors.surface-2}", border: "1px solid {colors.hairline}", rounded: "{rounded.lg}", padding: "{spacing.s6}", textColor: "{colors.ink}" }
  no-answer-evidence:  { textColor: "{colors.ink-3}", typography: "{typography.numeric}" }
  conflict-panel:      { border: "1px solid {colors.warning-border}", backgroundColor: "{colors.surface}", rounded: "{rounded.lg}", padding: "{spacing.s6}" }
  conflict-badge:      { backgroundColor: "{colors.warning-bg}", textColor: "{colors.warning}", rounded: "{rounded.sm}", padding: "2px 8px", typography: "{typography.caption}" }
  conflict-card:       { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", rounded: "{rounded.lg}", padding: "{spacing.s4}", equalWidth: true }
  upload-zone:         { backgroundColor: "{colors.surface}", border: "1px dashed {colors.hairline-strong}", rounded: "{rounded.lg}", padding: "{spacing.s8}", hover: { border: "1px dashed {colors.brand-600}", backgroundColor: "{colors.brand-50}" } }
  skeleton:            { backgroundColor: "{colors.surface-2}", rounded: "{rounded.sm}", animation: "opacity 1.6s ease-in-out infinite" }
  generating-pill:     { background: "{colors.ai-gradient}", textColor: "{colors.ink-inverse}", rounded: "{rounded.pill}", padding: "3px 10px", typography: "{typography.caption}", animation: "{motion.shimmer}" }
  question-chip:       { backgroundColor: "{colors.surface}", border: "1px solid {colors.hairline}", textColor: "{colors.ink-2}", typography: "{typography.body-sm}", rounded: "{rounded.sm}", padding: "5px 10px", height: 28 }
  question-chip-hover: { backgroundColor: "{colors.surface-2}", border: "1px solid {colors.hairline-strong}" }
  empty-state:         { icon: { size: 24, textColor: "{colors.ink-3}" }, title: "{typography.heading-2}", desc: { typography: "{typography.body-sm}", textColor: "{colors.ink-2}" } }
---

## 品牌

- **品牌关键词(设计评审的锚)**:平静、可信、精准、克制、专业。
- **一句话人格**:「像一位把证据摊在桌上的严谨工程师」——回答不是表演,而是带着编号依据的工作成果。
- **品牌标记**:18px 圆角方块(`{rounded.sm}`)填充 `{colors.ai-gradient}`,内含 2px 白色流线图形(抽象"知识流动");文字标 "KnowFlow" Inter 600 16px `{colors.ink}`,负字距 -0.01em。仅侧栏顶部与页面 `<title>` 使用。
- **色彩人格**:靛蓝(`{colors.brand-600}`)是唯一的品牌强调色,意为「AI 的确定性」;它出现的地方只有四类——主按钮、链接、激活态、AI 身份与引用。除此之外整屏保持中性灰,让知识内容自己说话。
- 参考来源(方向性借鉴,非复制):Linear 提供应用外壳与信息密度;Vercel 提供基础视觉与排版克制;Stripe 提供品牌色与少量渐变的用法;Mintlify 提供知识阅读与检索体验。KnowFlow 的回答页、引用系统、拒答与冲突呈现均为本项目自己的设计。

## 色彩语义

| Token | 含义 | 出现位置 |
| --- | --- | --- |
| `{colors.brand-600}` | AI 的确定性 / 品牌强调 | 主按钮、链接、激活态、AI 眉题点、引用 chip |
| `{colors.ai-gradient}` | **AI 在场**。渐变仅用于 AI/品牌身份标识(白名单 3 处) | 品牌标记、AI 眉题 8px 圆点、「AI 生成中」胶囊 |
| `{colors.canvas}` / `{colors.surface}` | 页底灰 / 卡片白:用表面层次而非阴影建立层级 | 全部页面 |
| `{colors.hairline}` | 边界:1px 发丝线承担绝大多数分隔 | 卡片、表格、列表 |
| `{colors.success*}` | 文档「已索引」、评测「达标」 | 状态徽标、指标表 |
| `{colors.warning*}` | **仅**文档口径冲突(分歧) | 冲突面板、分歧徽标 |
| `{colors.danger*}` | 解析失败、删除确认 | 状态徽标、危险按钮、确认弹窗 |
| `{colors.info*}` | 解析中/处理中 | 状态徽标 |
| `{colors.mode-*}` | 检索模式与来源徽标(固定语义,禁止换用) | 模式切换说明、依据条目、评测矩阵 |

- 铁律:**同屏最多 2 种彩色强调**(brand + 1 个语义色);语义色只用于「状态」,不用于装饰。
- 拒答**不使用** danger 色(拒答是正确行为,不是错误);冲突**不使用** danger 色(分歧是待用户裁决,不是故障)。

## 排版规则

- 字体:拉丁与数字用 **Inter**(`next/font` 本地打包,无 CDN 依赖),中文回退系统字体(PingFang SC / Microsoft YaHei);代码、ID、分数、run-id、params_hash 用 **Geist Mono**(回退 JetBrains Mono / Consolas)。
- 字重只有三档:**600(标题)/ 500(标签与强调)/ 400(正文)**;不使用 300 或 700。
- 答案正文与文档原文必须用 `{typography.body-lg}`(16px / 1.7 行高)——知识阅读是核心场景,正文排版不可压缩。
- 页面标题 28px、分区 20px、卡片 16px、证据卡 14px,共 9 级字号,禁止在阶外新造字号。
- **所有数字单元格、分数、耗时、指标值**用 `{typography.numeric}`(mono + tabular-nums)。
- 中英文/数字混排之间加一个空格(如「运行 3 种检索模式」);代码 token 与中文之间同理。
- 眉题(eyebrow)用 `{typography.micro}` 全大写英文或 11px 中文,不加重。

## 布局解剖

```
┌────────────────────────────────────────────────────────────┐
│ Sidebar 224px │          Content 区           │ Source 抽屉 360px │
│ (白底/右发丝线) │  max-width 760px 居中,两侧留白   │ (点引用滑出,遮罩)  │
│               │                                 │                 │
│ 品牌标记        │  页头:标题(28) + 右侧操作         │  文档标题         │
│ 问答 /         │  ──────────────────────        │  原文片段(完整)   │
│ 文档库 /        │  正文区:                        │  分数/模式徽标     │
│ 评测 /         │  · 回答页(AnswerSheet)          │  打开原文         │
│ 关于           │  · 表格页(文档库/评测)            │                 │
│               │  · 上传区                       │                 │
│ 底部:版本+     │                                 │                 │
│ synthetic 声明 │                                 │                 │
└────────────────────────────────────────────────────────────┘
```

- 阅读列宽:**回答与依据内容 max-width 760px**;源文档正文同宽,保证长文阅读不换行疲劳。
- 断点:`≥1024px` 侧栏常驻 + 抽屉浮层;`768–1023px` 侧栏收起为顶栏(白底、高 48px、底发丝线、左品牌标记 + 右菜单 icon 按钮 32px,点开抽屉式菜单),抽屉 360px;`<768px` 单列,抽屉全屏;< 375px 无横向溢出(表格在容器内横向滚动,chips 允许折行)。
- 页面头节奏:页头区(标题 + 操作)高度 64px,与正文间距 `{spacing.s6}`;页内分区间距 `{spacing.s8}`。
- 间距基准:4px 网格;卡片内边距 24px,依据条目 16px,表格单元格 12px。

## 组件规格

### 通用组件

| 组件 | 规格要点 |
| --- | --- |
| Button(primary/secondary/ghost/danger/icon) | 高度 36px、圆角 6px、14px/500;**每屏仅一个 primary**;danger 仅用于「删除」确认 |
| Link | brand-600,默认无下划线,悬停下划线;不作为按钮替代(操作=按钮,跳转=链接) |
| TextInput / AskTextarea | 见 front matter;焦点态 = brand 描边 + 3px focus-ring;错误态 = danger 描边 |
| Badge | 高度 22px、圆角 6px、12px 文字;五种语义见 front matter;**徽标只用方形,不用胶囊** |
| Table | 白底 + 发丝线容器(圆角 8px);表头 surface-2 底 12px/500;行 13px;行悬停 surface-2;数字列 numeric token |
| Modal | 420px 居中、圆角 12px、遮罩 0.32;标题 16px/600;操作右对齐(取消 ghost + 确认 primary/danger);Esc 关闭;仅用于不可逆确认(删除文档) |
| Drawer | 右侧 360px 滑入(motion.medium)、遮罩 0.16;标题 20px/600;Esc 关闭;详情见 AI 特有组件「来源抽屉」 |
| Toast | 底部居中上方浮出、4s 自动消失;仅 success/info/danger 三态;一次只出现一条 |
| EmptyState | 图标 24px ink-3 + 标题 16px/600 + 说明 13px ink-2 + 一个 secondary 操作;无插画 |
| QuestionChip | 示例问题(问答页):白底 + 发丝线,悬停 surface-2;点击填入提问框;内容来自评测集 query |
| Skeleton | 灰阶脉动条(surface-2,透明度呼吸);仅用于检索中/评测运行中占位 |
| Icon | 线性几何图标,1.5px 笔画,16/20px 两档;禁止 emoji 与拟物图标 |

### AI 与知识特有组件规范

**1. 回答页(AnswerSheet)**——KnowFlow 的签名组件,替代聊天气泡。
- 结构(自上而下):① 元信息行 → ② AI 回答正文 → ③ 依据带 → ④ 操作行。
- ① 元信息行(`{components.answer-sheet-meta}`):`已基于企业知识库检索 · 依据 n 条`——依据数 mono + tabular-nums。2026-09-09 人拍板:模式徽标/最高分/耗时属工程调试信息,迁出主流程(保留在 API 与 QA 日志,检索质量展示由评测页承载);检索策略由系统固定为默认 Hybrid + Rerank,普通用户不选择。
- ② 回答正文:`{typography.body-lg}`;前置 AI 眉题(micro「AI 回答」+ 8px 渐变圆点);正文内的断言后紧跟引用 chip。
- ③ 依据带:小节标题「依据与来源(n)」;n 个依据条目按 [1..n] 编号纵向排列。
- ④ 操作行:重新生成(secondary)/ 复制回答(ghost)/ 有用·无用(ghost 文字按钮)。
- 交互:回答与依据**同屏并置**,不需要跳页即可核对;禁止把回答渲染成左右对话流或聊天气泡。

**2. 引用 chip(CitationChip)**——KnowFlow 自己的引用视觉。
- 外观:`[n]` 方形 chip,mono 12px,`brand-800` 文字 + `brand-100` 底,圆角 6px;点击热区 ≥ 32px(移动端 ≥ 44px)。
- 悬停/键盘聚焦:chip 反色(brand-600 底白字),同时触发双向联动(见 3)。
- 语义:编号由规则侧映射(ai-design FR-05),**视觉顺序必须与依据带编号一致**;任何引用错误(指向缺失)显示为灰态不可点 + 提示,不静默。

**3. 依据条目(EvidenceItem)+ 双向证据联动**——KnowFlow 独有的核对交互。
- 结构:[1] 编号 chip · 文档标题(heading-3)· 章节/更新时间(caption ink-3)· 引用片段(evidence-quote:surface-2 底 + 2px brand-100 左边线,13px,最多 4 行可展开)· 元信息行(来源徽标:向量/关键词/混合 · rerank 分数 mono ·「查看原文」链接)。
- **双向联动**:① 悬停引用 chip → 回答正文中对应引用句高亮(brand-50 底)+ 对应依据条目高亮(brand-600 描边)并滚动进入视口;② 悬停依据条目 → 回答正文中对应引用句高亮。这是"每条断言都能对到原文"的交互表达,支撑 5 分钟演示闭环的「点开来源核对原文」。
- 分数展示:vector/keyword 来源显示检索分,hybrid_rerank 模式显示 rerank 分,一律 mono 保留 2 位小数。

**4. 来源抽屉(SourceDrawer)**——点「查看原文」或引用 chip 滑出。
- 内容:文档标题(20px/600)+ 元信息(格式徽标 · 状态徽标 · 上传时间)+ 完整 chunk 原文(body-lg 排版,段落保留)+ 该 chunk 的检索分数与来源模式 + 「在文档库中查看」链接。
- 抽屉内原文可滚动,无分页;来源定位 = 滚动到对应 chunk 并短暂高亮(brand-50 底,motion.fast)。

**5. 拒答卡(NoAnswerCallout)**——平静的中性灰,不是错误。
- 外观:surface-2 底 + 发丝线,信息图标(16px ink-3),标题「知识库中未找到答案」heading-2,说明文字 body-md ink-2。
- 检索证据行(no-answer-evidence):`依据 0 条`(mono)——拒答的轻量事实注脚;检索分数与阈值属工程调试信息,不进主流程(2026-09-09 人拍板,保留在 API 与 QA 日志)。
- 建议三条(body-sm ink-2):「换个说法再试一次」「确认文档已上传到文档库」「仍不确定时,联系知识库管理员确认」。
- 禁止:红色、感叹号、失败动画。

**6. 冲突面板(ConflictPanel)**——并列呈现,不选边。
- 结构:① 分歧徽标(「口径不一致」warning 徽标)+ 一句话声明「以下文档对同一问题的表述不一致,KnowFlow 不替您选边」;② 两份文档依据卡**左右等宽并列**(<768px 纵向堆叠),每张卡 = 文档标题 + 版本/更新时间 + 引用片段;③ 两张卡之间无任何胜负标记、无推荐角标。
- 交互:每张卡可点开对应来源抽屉,由用户自己裁决。

**7. 文档状态徽标(DocStatusBadge)**:已索引 = success · 解析中 = info · 解析失败 = danger · 待索引 = neutral。与 FR-01 状态机(parsing/indexed/failed)一一对应。

**8. 上传区(UploadZone)**:发丝虚线框卡(圆角 10px、内边距 32px);文案「拖入或选择文档」+ 支持格式列表(mono:`.md .pdf .docx .html .txt`)+ caption「不支持 OCR,扫描件请先转文本」。拖拽悬停 = brand 虚线 + brand-50 底;上传中显示该文档行内进度(无全局遮罩)。

**9. 评测矩阵(EvalMatrix)**:行 = 三模式(向量 / 混合 / 混合+重排),列 = 7 类场景 + Hit@5 + MRR;所有数字 numeric token;「混合+重排」行 = surface-2 底 + 达标徽标(success「达标」/ neutral「记录值」),其余行仅显示数值并加 caption「仅混合+重排设达标线」;矩阵下方页脚 caption 标注数据来源:`数据来源 run-{run_id}.json · params_hash {前 8 位}`——诚信规则(只引用实测 run JSON)的视觉落点。

**10. 运行历史(RunList)**:run_id(mono)/ 模式 / params_hash(mono 截断)/ doc_commit(mono 截断)/ 时间 / Hit@5 / MRR / 状态徽标(运行中 info / 完成 success / 失败 danger);点击行展开该 run 的 per-case 明细表。

**11. 生成中态**:检索中 = 灰阶 Skeleton;生成中 = 「AI 生成中」胶囊(唯一 pill + 唯一 shimmer 动画,渐变白名单第 3 处)。**除此处外,全站无任何加载动画装饰。**

## 状态规范

### 交互状态(所有交互组件)

| 状态 | 规范 |
| --- | --- |
| hover | 颜色/背景变化 150ms;卡片微抬仅用 `{shadows.hover}`,不得加边框加粗 |
| focus-visible | 2px `{colors.brand-600}` 描边 + 2px 偏移,全站统一;禁止移除焦点环 |
| pressed | brand-800 / surface-2 下沉,无位移动画 |
| disabled | surface-2 底 + ink-disabled 文字;禁用态给出原因 caption(如「知识库为空,请先上传文档」) |
| loading | Skeleton / 生成中胶囊;禁止旋转加载图标于内容区(仅按钮内 16px 细环允许) |

### 文档状态机(FR-01/FR-09)

```
上传 → 解析中(info) → 已索引(success) → 删除确认(danger modal) → 移除
                 ↘ 解析失败(danger, 行内错误说明 + 重试)
```

### 问答状态机(FR-04/05/06/07)

```
空闲(提问框+示例问题) → 检索中(Skeleton) → 生成中(胶囊) →
  ① 正常回答:AnswerSheet(元信息行 → 正文 → 依据带 → 操作行)
  ② 拒答:NoAnswerCallout(中性灰 + 检索证据行)
  ③ 冲突:AnswerSheet(正文带分歧提示)→ ConflictPanel(等权双卡)
  ④ 失败:inline 错误卡(danger 图标 + 重试 ghost 按钮;文案区分 5xx 模型异常与超时)
```

## 迭代指南

1. **何时可以新增 token**:先在本文档 front matter 添加/修改 → 再改代码;同一值禁止在代码中重复定义;偏离 front matter 的硬编码值即违规(DesignRules 禁止事项第 1 条)。
2. 组件迭代:一次只改一个组件;变体以 `-hover / -pressed / -active / -disabled` 后缀登记,不另起新名字。
3. 新组件必须写明:用途、结构、token 引用、交互、**何时不用**(反例场景)。
4. 任何新视觉决策必须在 DesignRules.md 的「UI 原则」中找到对应依据,否则先质疑该决策的必要性。
5. 改品牌色/渐变/字号阶 = 改系统级 token,须人拍板后重跑页面走查(Stage 13 走查记录)。
6. 暗色模式本期不做(记 Future Expansion):当前 token 均为 light;未来加 dark 时新增 `dark:*` 命名空间,不覆盖现有值。
