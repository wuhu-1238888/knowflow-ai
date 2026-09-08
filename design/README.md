# Design

KnowFlow AI 设计系统(Stage 09 产出)。

| 文件 | 职责 |
| --- | --- |
| `DesignRules.md` | 设计原则与视觉/交互规则:「必须做 / 禁止做」,含可 grep 检查的禁止事项与提交前自检清单 |
| `DesignSystem.md` | 可执行的 Design Tokens(YAML front matter = 单一事实来源)、组件规范、状态规范、AI/Knowledge 特有组件规范 |
| `references/` | 设计参考素材(Linear/Vercel/Stripe/Mintlify 品牌分析,方向性借鉴,非复制) |

**使用铁律**:UI Coding 必须直接引用这两个文件;需要新值先改 `DesignSystem.md` front matter 再使用,禁止在代码中硬编码偏离值。

**设计方向**(人拍板 2026-09-09):

- Linear → 整体 SaaS 布局、导航、信息密度、交互
- Vercel → 基础视觉、Typography、边界、极简感
- Stripe → 品牌色、AI Accent、少量品牌渐变
- Mintlify → Knowledge Base、Document、Search UX

**KnowFlow 自己的设计语言**(差异化要点):

1. **回答页(AnswerSheet)**代替聊天气泡——回答 + 依据同屏并置的"答卷式"布局;
2. **证据链接**——引用 chip [n] 与依据条目双向联动,每条断言可对到原文;
3. **拒答 = 中性灰卡 + 检索分数与阈值展示**(不是红色错误);
4. **冲突 = 琥珀 + 等宽等权双卡**,不替用户选边;
5. **AI 渐变白名单**——仅品牌标记 / AI 眉题点 / 生成中胶囊 3 处;
6. 中性灰画布 + 发丝线 + 表面层次,动效 ≤ 200ms,无内容入场动画。
