# 关于页(3.3.5)测试验收指引

> 版本:v0.1 | 2026-09-10
> 适用:任务 3.3.5 关于页(定位一句话 / NovaTech 虚构数据声明卡 / 技术栈列表 / 边界说明)L4 手工走查与切片验收
> 口径:本页无交互、无后端改动(纯静态内容页),走查以内容核对与视觉规范为主;所有预期值来自实测(前端 vitest 133 例含关于页 8 例、tsc 干净、页面 200)。

## 0. 环境与前置(约 1 分钟)

- 前端 3001 已运行;浏览器打开 http://localhost:3001/about
- 页头标题为「**关于**」,内容区宽度 880px 居中(app-shell `/about` 档,DesignRules 人拍板口径)

## 1. 四区块齐全检查(约 2 分钟)

按序核对页面自上而下四个区块(每区一个 16px/600 二级标题):

1. **产品定位**:一句话,与 product-vision.md 定稿逐字一致——含「带来源引用」「明确拒答」「可复现的检索质量实测数据」三个承诺;正文 16px 阅读排版
2. **演示数据声明**:中性卡片(白底 + 发丝线描边 + 圆角 10px,内边距 24px),三段正文级排版
3. **技术栈**:6 行列表(前端/后端/数据/检索/生成/解析),值全部 mono 字体,行间发丝线分隔
4. **产品边界**:6 条「不做」摘要,每条带一句理由

## 2. 声明完整性检查(约 2 分钟,专属禁令)

1. 声明卡含:NovaTech 为**虚构企业**、不指向任何真实企业
2. 声明卡含:全部演示文档为**合成演示数据**(synthetic: true)、仅用于演示与评测
3. 声明卡含:本项目**不接入任何真实企业数据**,声明适用于一切文档、页面与演示场合
4. **grep 级核对**:页面上**不出现**「真实企业客户」「真实商业项目」字样(禁止将 NovaTech 描述为真实企业客户或真实商业项目);侧栏底部 v0.1.0 + synthetic 脚注与本页声明口径一致

## 3. 技术栈真实性核对(约 2 分钟,禁止虚构)

与仓库实况逐条对照(package.json / rag_service/requirements.txt / technical-design.md):

| 行 | 页面 mono 值 | 实况出处 |
| --- | --- | --- |
| 前端 | Next.js 15(App Router)· React 19 · TypeScript · Tailwind CSS 4 | package.json dependencies |
| 后端 | Python · FastAPI · Uvicorn | requirements.txt / main.py |
| 数据 | SQLite(元数据)· LanceDB(向量 · BM25 全文倒排) | db.py / retrieval.py |
| 检索 | bge-m3(Embedding)· BM25 关键词 · bge-reranker-v2-m3(重排) | indexing.py / eval_engine.py |
| 生成 | LLM 适配层(可插拔)· Mock 默认 · DeepSeek API(Key 由用户配置) | llm_adapter.py / deepseek_provider.py |
| 解析 | PyMuPDF(pdf)· python-docx(docx)· Markdown / HTML / TXT 规则清洗 | parsing.py |

## 4. 边界说明核对(约 1 分钟)

6 条摘要与 PRD「明确不做清单」一致(摘要而非全文):多租户与权限体系(RBAC/SSO)、Agent 自主任务/会话记忆/Tool Calling、多模态 RAG/OCR、自训练 Embedding/Reranker、企业系统集成(IM/网盘/CRM)、接入真实企业数据。每条带一句理由(如「MVP 为单租户演示」「克隆即可跑」)。

## 5. 视觉与无障碍(DesignRules 硬规则)

- **375px 窄屏**:四区块无横向溢出;声明卡与技术栈列表折行正常
- **数字全 mono**:版本号(Next.js 15、React 19)与模型名(bge-m3 等)均位于 mono 值内;无 emoji、无插画、无渐变
- **页面无 primary 按钮**:本页纯内容,无任何按钮(每屏一个 primary 规则不涉及)
- **无硬编码指标**:整页无 Hit@5/MRR 等评测数字(定位句只说「可复现的检索质量实测数据」,具体数字只在评测页)

## 6. 判定标准

- **Blocker(不通过,当场修复)**:区块缺失;声明卡缺 NovaTech 虚构/synthetic 标注任一要素;出现「真实企业客户」「真实商业项目」表述;技术栈与仓库实况不符(虚构依赖);页面 500/白屏
- **样式打磨类(记遗留,不阻塞)**:间距/行距微调;边界说明条数微调

## 7. 验收结论

- 结论格式:走查人逐项给出 通过/不通过;Blocker 当场修复后重走;样式打磨记遗留。
- 结论落档:design/DesignRules.md「走查记录」+ memory-bank/progress.md Round 5。
