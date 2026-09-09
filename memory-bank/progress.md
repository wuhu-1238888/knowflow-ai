# 开发进度(Progress)

> 版本:v0.1 | 最后更新:2026-09-09
> 对应:执行期持续维护(执行日志)

<!-- 头部:测试基线,随任务更新 -->
- 测试基线:后端 pytest 127/127 + 前端 vitest 44/44(M3 首批任务后全绿,2026-09-09)

## Round 1:Stage 01–08 文档阶段完成表

| 任务 | 内容 | 状态 | commit |
| --- | --- | --- | --- |
| Stage 01 | product-vision.md | 已完成(2026-09-08 人拍板) | — |
| Stage 02 | user-persona.md | 已完成(2026-09-08 人拍板) | — |
| Stage 03 | problem-analysis.md | 已完成(2026-09-08 人拍板,R-08 冲突呈现进 P0) | — |
| Stage 04 | competitor-analysis.md | 已完成(2026-09-08 人拍板,轻量版) | — |
| Stage 05 | PRD.md | 已完成(2026-09-08 人拍板,P0 冻结) | — |
| Stage 06 | product-architecture.md | 已完成(2026-09-08 人拍板) | — |
| Stage 07 | ai-design.md + NovaTech 文档集 + cases.yaml 评测集 | 已完成(2026-09-08 人拍板;14 例已标注) | — |
| Stage 08 | technical-design.md + docs/evaluation-plan.md 定稿 | 已完成(2026-09-09 人拍板,选型 9 项+阈值定稿) | — |
| 初始化 | 骨架 + CLAUDE.md + 模板暂存区 + git init | 已完成 | — |

- **主要修改**:建立项目骨架;拷贝工作流模板至 `docs/templates/`;改写 CLAUDE.md(背景/验收锚点/隔离红线/git 纪律);git init 首次提交。
- **测试结果**:—(文档阶段无代码)
- **已知问题(遗留,不隐瞒)**:见下方遗留清单。
- **下一步**:Stage 01 项目定义,起草 product-vision.md 待人拍板。

## Round 2:Stage 09–10 完成表

| 任务 | 内容 | 状态 | commit |
| --- | --- | --- | --- |
| Stage 09 | design/DesignRules.md + design/DesignSystem.md(设计系统) | 已完成(2026-09-09 人拍板:品牌方向确认 + 自有设计语言接受) | `504c832` |
| Stage 10 | implementation-plan.md(实施计划) | 已完成(2026-09-09 人拍板:τ=0.30/常量初值/偏差记录 1 全接受) | `2a66fba` |

## Round 3:Stage 11 编码(M1 工程地基)

| 任务 | 内容 | 状态 | commit |
| --- | --- | --- | --- |
| 3.1.1 | 仓库骨架与双进程一键启动 | 已完成(Next.js 15.5 + FastAPI 0.141,双进程验证通过,typecheck 干净) | `ea10794` |
| 3.1.2 | 设计 token 落库 + 应用外壳 | 已完成(24/24 测试绿:L1 token 对拍 12 + 组件/外壳 12;typecheck 干净;四页 L4 走查 200;src/ 零硬编码 hex 与零白名单外渐变) | `47f8005` |
| 3.1.3 | 元数据库与仓库层 | 已完成(pytest 21/21 绿;真实 runtime 装载 20 文档 + 14 例且幂等;runtime/ 不入库) | `639213a` |

### M1 验收记录(2026-09-09,走查人:王荟茹)

- **测试结果**:前端 24/24(vitest)、后端 21/21(pytest)、typecheck 干净、seed 幂等实测(两次 20/14 不翻倍)、四页 200、RAG /health ok、设计规则 grep 全过(src/ 零硬编码 hex;渐变/阴影仅白名单档;无 pill 按钮)。
- **L4 走查**:通过(结论已记入 design/DesignRules.md「走查记录」:375px 无溢出/断点行为/焦点环/动效四项)。
- **L2 API 口径**:M1 仅 /health 无业务端点;L2 四类用例(成功/鉴权失败/越权/非法参数)自 M2 业务端点(/api/ask 等)起随功能覆盖;MVP 无鉴权本地绑定,鉴权/越权类按不适用记录。
- **端口决策**:开发端口固定 3001(commit `5dd2868`),详见修订记录。
- **Blocker**:无。**遗留**:#5(npm audit postcss 2 advisories,修复需升 next@16,待人选型裁决)继续挂账;#1/#3/#4 维持原状。
- **退出条件**:**带遗留通过**(2026-09-09 人拍板)→ 进入 M2。

## Round 4:Stage 11 编码(M2 纵向核心链路)

| 任务 | 内容 | 状态 | commit |
| --- | --- | --- | --- |
| 3.2.1 | LLM 适配层 + Mock Provider | 已完成(pytest 28/28 绿;Mock 确定性输出与 AnswerDraft 契约断言通过) | `afee029` |
| 3.2.2 | ParsingService(5 格式解析) | 已完成(pytest 40/40 绿;5 格式夹具断言+边界 12 例;20 篇演示文档全量可解析) | `eae4e75` |
| 3.2.3 | IndexingService | 已完成(pytest 54/54 绿;L2 实测 20 篇 72 chunks、重跑幂等、20/20 indexed) | `fc0e736` |
| 3.2.4 | RetrievalService | 已完成(pytest 70/70 绿;L2 真实模型四模式冒烟:报销凭证查询 doc-hr-03/04 置顶,rerank 后无关文档压末位) | `c71a58d` |
| 3.2.5 | EvaluationEngine | 已完成(pytest 92/92 绿;L5 两轮实测:hybrid_rerank Hit@5 12/12、MRR 0.9583 → **M2a 达标**;FR-08 两轮逐例一致) | `1ebfa52`(run 产物 `b013b2f`) |
| 3.2.6 | AnswerPipeline + /api/ask | 已完成(pytest 127/127 绿;真实链路 200:答案+3 引用+QA 日志落库;L5 三模式 42 例全链路跑通;**M2b 带遗留通过**;τ 拍板 A:0.30 维持 + τ_v=0.58) | `de08d7d`(L5/校准产物 `e1cd564`/`1941ccc`) |

### M2a 验收记录(2026-09-09,拍板人:王荟茹)

- **实测(两轮,FR-08 逐例排名/hit 列表/指标/params_hash 完全一致)**:vector 12/12 MRR 0.9583;hybrid 12/12 MRR 0.9028;**hybrid_rerank 12/12 MRR 0.9583**。
- **达标线核对**:Hit@5 12/12 ≥ 11/12 ✓;MRR 0.9583 ≥ 0.8 ✓。
- **证据**:docs/eval-results/run-2026-09-09T055305Z-{vector,hybrid,hybrid_rerank}.json(params_hash `365740ee216243e4`,doc_commit `fe2ebd0`);指标矩阵 matrix-2026-09-09T055305Z.md。
- **退出条件**:**通过**(2026-09-09 人拍板)→ 进入 3.2.6(M2b)。

### M2b 验收记录(2026-09-09,拍板人:王荟茹)

- **τ 拍板(A 方案)**:τ_rerank=0.30 维持(实测两侧余量 ≥0.29);τ_v=0.58 采纳(窗口 0.0517 已披露,默认模式 hybrid_rerank 缓释)。依据 docs/eval-results/tau-calibration.md。
- **五线实测(Mock,42 例全链路,证据 review-2026-09-09T064633Z.md / gen-*.json)**:
  - 拒答 ✓:三模式均 2/2 拒答 + 12 例 0 误拒(τ 规则真实生效);
  - 引用 ✓(结构):每条引用 quote 均为被检索 chunk 原文子串(规则侧重建);
  - 幻觉 ✓(结构):Mock 逐字摘录,结构性零幻觉;
  - 要点覆盖率 ✗:Mock 摘首句生成,机器预检大多 0–2/n → **挂账遗留 #1**(检索本身 12/12 命中,非检索问题);
  - 冲突 ✗:conflicts 恒 None → **挂账遗留 #1**(C13/C14 双方文档均检索到)。
- **退出条件**:**带遗留通过**(2026-09-09 人拍板)→ M2 里程碑验收;要点覆盖率/冲突检测真实 LLM 能力验收归遗留 #1(真实 Key 到位后重跑同一套 L5)。

### M2 里程碑验收记录(2026-09-09,拍板人:王荟茹)

- **完成表**:3.2.1 `afee029` / 3.2.2 `eae4e75` / 3.2.3 `fc0e736` / 3.2.4 `c71a58d`+`fe2ebd0` / 3.2.5 `1ebfa52`(M2a 通过)/ 3.2.6 `de08d7d`+(M2b 带遗留通过,τ 拍板 A)。
- **测试基线**:后端 pytest 127/127、前端 vitest 24/24,全绿;typecheck 干净。
- **检索层达标**:hybrid_rerank Hit@5 12/12(≥11/12)、MRR 0.9583(≥0.8);FR-08 三轮重跑逐例一致。
- **真实链路**:POST /api/ask 实测 200(答案 + 3 条规则侧引用 + QA 日志落库,confidence 0.8336)。
- **遗留**:#1 挂账范围扩大(要点覆盖率 ≥90% / 冲突检测 2/2 / 幻觉真检验,真实 Key 到位后重跑同一套 L5 验收);#3/#4/#5 不变。
- **退出条件**:**带遗留通过**(2026-09-09 人拍板)→ 进入 M3(Phase 3.3 横向功能扩展,3.3.1 Next.js BFF 代理层起步)。

## Round 5:Stage 11 编码(M3 横向功能扩展,首批:问答链路可见)

| 任务 | 内容 | 状态 | commit |
| --- | --- | --- | --- |
| 3.3.1 | Next.js BFF 代理层 + typed client | 已完成(rag.ts 代理+client、6 条 route、L2 测试 8 例;前端 vitest 32/32 绿、typecheck 干净) | (与 3.3.2 同批) |
| 3.3.2 | 问答页最小闭环切片 | 已完成(状态机问答页 + 6 个 AI 组件 + L3 测试 12 例;前端 vitest 44/44 绿;L2 实测:年假→200 答案+3 引用 0.8336、拒答→no_answer 0.0015、交通费→双口径并列 0.9930) | (同批) |

### M3 首批任务记录(2026-09-09,依据人「继续下一步吧」启动)

- **范围**:M2 为纯后端,界面不可见 → 首批做 3.3.1(BFF 代理)+ 3.3.2 问答页最小闭环切片(提问 → 带引用回答 / 拒答 / 冲突 / 失败态),完成后用户在 3001 直接提问即可看到 M2 成果。
- **实测(BFF 链路,真实模型)**:POST /api/ask(经 3001 代理)→ 年假问题 200,答案+3 条规则侧引用,confidence 0.8336,首问 90s(模型加载);拒答问题 200,no_answer=true,confidence 0.0015;交通费问题 200,双口径并列回答 0.9930。页面 / 200。
- **测试基线**:前端 vitest 44/44(新增 rag.test 8 + page.test 8 + answer-sheet.test 4)、后端 pytest 127/127 不变、typecheck 干净。
- **L4 走查**:待人操作(3001 打开问答页:三示例 chip 点击、模式切换、拒答卡中性灰、Enter/Shift+Enter、`/` 聚焦、375px 无溢出)。
- **偏差/已知**:C13 chip 在 Mock 下演示双口径并列回答(conflicts 恒 null,冲突面板 UI 已实现并经 L3 覆盖,真实验收归遗留 #1);3.3.2 全量项(双向联动/CitationChip/SourceDrawer/操作行完整版)继续推进;build 未跑(dev server 运行中,纪律:build 须无 dev server,下轮停服时补)。
- **下一步**:3.3.2 全量交互补齐 → 3.3.3 文档库页 → 3.3.4 评测页 → 3.3.5 关于页。

## 修订

<!-- 格式:{YYYY-MM-DD 主题} → 背景/现象与根因/实施/验证/已知取舍 -->

{2026-09-09 开发端口固定 3001} → 现象:KnowFlow 默认端口随 3000 是否空闲漂移(3000 被占时 Next 自动落 3001,空闲时回 3000),与 CareerOS(固定 3000)存在抢占风险。实施:人拍板固定 3001——`next dev -p 3001` 与 `next start -p 3001`,显式 -p 时 Next 端口被占即报错退出(EADDRINUSE),不自动切换;README 同步。验证:实测 3001 被占时明确报错且未落 3000;正常 `npm run dev` 监听 3001,页面 200。取舍:无新依赖,纯 Next CLI 标准参数。

## 已解决的问题

| # | 问题 | 根因 | 修复 |
| --- | --- | --- | --- |
| 1 | pip 安装报 UnicodeDecodeError(gbk) | requirements.txt 含中文注释,pip 在中文 Windows 以 GBK 解码 UTF-8 失败 | 依赖清单注释改纯 ASCII(2026-09-09,任务 3.1.1) |
| 2 | Vitest 5 不解 TSX(jsx: "preserve") | Next.js 要求 tsconfig jsx=preserve,Vitest 5(rolldown)不转换 JSX,import-analysis 报语法错 | 新增 devDependency @vitejs/plugin-react(Babel 转换)+ 未开 globals 时显式 cleanup 注册(2026-09-09,任务 3.1.2) |

## 未解决的问题(遗留,编号滚动)

| # | 问题 | 影响范围 | 处置计划 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 真实 LLM Key 未验证 | RAG 生成链路 | Mock 先行开发;真实 Key 到位后重跑同一样例集(L5 真实模型补充验证);**M2b 挂账两线(要点覆盖率 ≥90%、冲突检测 2/2)与幻觉真检验一并在此重跑验收**(2026-09-09 M2b 带遗留通过时明确) | 挂账 |
| 2 | git remote 未设置/公开与否未定 | 仓库发布 | 已解决(2026-09-08 人拍板:暂不设 remote,仅本地提交;公开决策留待后续) | 已解决 |
| 3 | OCR/多模态文档不支持 | 文档解析范围 | 已入 vision 不做清单(MVP 边界),记录 Future Expansion | 挂账 |
| 4 | 商业 Embedding/Reranker 未对比 | 选型完整性 | 可选:实测达标后做对照实验,不阻塞 MVP | 挂账 |
| 5 | npm audit:next@15 传递依赖 postcss 2 个 advisories(1 moderate/1 high) | 前端依赖 | 修复需升级 next@16(破坏性变更,偏离已拍板选型)→ **待人选型裁决**;本地 demo 不暴露公网,风险低 | 挂账 |
