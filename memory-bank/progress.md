# 开发进度(Progress)

> 版本:v0.1 | 最后更新:2026-09-09
> 对应:执行期持续维护(执行日志)

<!-- 头部:测试基线,随任务更新;Round 1 为文档阶段,暂无代码用例 -->
- 测试基线:0 个用例 / 0 个文件(编码期开始后更新)

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
| 1 | 真实 LLM Key 未验证 | RAG 生成链路 | Mock 先行开发;真实 Key 到位后重跑同一样例集(L5 真实模型补充验证) | 挂账 |
| 2 | git remote 未设置/公开与否未定 | 仓库发布 | 已解决(2026-09-08 人拍板:暂不设 remote,仅本地提交;公开决策留待后续) | 已解决 |
| 3 | OCR/多模态文档不支持 | 文档解析范围 | 已入 vision 不做清单(MVP 边界),记录 Future Expansion | 挂账 |
| 4 | 商业 Embedding/Reranker 未对比 | 选型完整性 | 可选:实测达标后做对照实验,不阻塞 MVP | 挂账 |
| 5 | npm audit:next@15 传递依赖 postcss 2 个 advisories(1 moderate/1 high) | 前端依赖 | 修复需升级 next@16(破坏性变更,偏离已拍板选型)→ **待人选型裁决**;本地 demo 不暴露公网,风险低 | 挂账 |
