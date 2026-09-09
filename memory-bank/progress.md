# 开发进度(Progress)

> 版本:v0.1 | 最后更新:2026-09-09
> 对应:执行期持续维护(执行日志)

<!-- 头部:测试基线,随任务更新 -->
- 测试基线:后端 pytest 132/132 + 前端 vitest 79/79(M3 首批任务 + 检索策略产品决策 + 页面容器加宽 + 问答页垂直节奏 + 3.3.2 全量交互补齐后全绿,2026-09-09)

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
| 3.3.2 修订 | 检索策略产品决策(2026-09-09 人拍板) | 已完成(问答页移除策略切换、固定默认 Hybrid+Rerank;元信息行/拒答卡去工程调试值;前端 vitest 47/47 绿) | (见下) |
| 3.3.4(提前切片) | 评测页检索策略对比 + 选型叙事 | 已完成(三模式对比表:实测 Hit@5/MRR + 未实现指标显式「暂无数据」;L3 测试 4 例) | (见下) |
| 布局修订 | 页面容器宽度分档 + 问答页克制副标题 | 已完成(2026-09-09 人拍板「宽幅居中 + max-width 封顶」;前端 vitest 58/58 绿) | (见下) |
| 布局修订 2 | 问答页垂直节奏(顶部呼吸空间 + 区块间距统一) | 已完成(2026-09-09 人拍板;前端 vitest 59/59 绿) | (见下) |
| 3.3.2 全量 | 引用 chip / 双向证据联动 / 来源抽屉 / 重新生成 / 有用·无用(FR-11/FR-12) | 已完成(后端 pytest 132/132 + 前端 vitest 79/79 绿;typecheck 干净) | (见下) |

### M3 首批任务记录(2026-09-09,依据人「继续下一步吧」启动)

- **范围**:M2 为纯后端,界面不可见 → 首批做 3.3.1(BFF 代理)+ 3.3.2 问答页最小闭环切片(提问 → 带引用回答 / 拒答 / 冲突 / 失败态),完成后用户在 3001 直接提问即可看到 M2 成果。
- **实测(BFF 链路,真实模型)**:POST /api/ask(经 3001 代理)→ 年假问题 200,答案+3 条规则侧引用,confidence 0.8336,首问 90s(模型加载);拒答问题 200,no_answer=true,confidence 0.0015;交通费问题 200,双口径并列回答 0.9930。页面 / 200。
- **测试基线**:前端 vitest 44/44(新增 rag.test 8 + page.test 8 + answer-sheet.test 4)、后端 pytest 127/127 不变、typecheck 干净。
- **L4 走查**:待人操作(3001 打开问答页:三示例 chip 点击、无策略切换入口、拒答卡中性灰、Enter/Shift+Enter、`/` 聚焦、375px 无溢出;评测页:对比表实测数字与来源页脚)。
- **偏差/已知**:C13 chip 在 Mock 下演示双口径并列回答(conflicts 恒 null,冲突面板 UI 已实现并经 L3 覆盖,真实验收归遗留 #1);3.3.2 全量项(双向联动/CitationChip/SourceDrawer/操作行完整版)继续推进;build 未跑(dev server 运行中,纪律:build 须无 dev server,下轮停服时补)。
- **下一步**:3.3.2 全量交互补齐 → 3.3.3 文档库页 → 3.3.4 评测页全量(运行按钮/运行历史/动态数据)→ 3.3.5 关于页。

### 检索策略产品决策(2026-09-09,拍板人:王荟茹)

- **决策**:「知识问答」页移除「向量/混合/混合+重排」切换入口;普通用户不选择 RAG 策略,系统固定默认 **Hybrid + Rerank**(后端 /api/ask 默认已是 hybrid_rerank,客户端默认一致,零后端改动);三模式保留为底层能力与评测对比维度,迁移至「评测」页。
- **配套决策**:①AnswerSheet 元信息行 → 「已基于企业知识库检索 · 依据 n 条」(模式徽标/最高分/耗时属工程调试值,迁出主流程;保留在 API 响应与 QA 日志);②拒答卡证据行 → 「依据 0 条」,并新增「联系知识库管理员」建议(AI Trust UX 第 6 条);③评测页提前切片交付静态快照对比表——Hit@5/MRR 为 2026-09-09T063730Z 实测值(三模式均 12/12;MRR 0.9583/0.9028/0.9583),Recall@K/Precision@K/平均延迟尚未纳入评测引擎 → 显式「暂无数据」,禁止虚构;选型叙事诚实:当前演示库上「重排」与「向量」并列最高,不预设「重排一定最好」。
- **文件**:page.tsx / answer-sheet.tsx / no-answer-callout.tsx / eval/page.tsx(+测试);删除 segmented.tsx;DesignRules/DesignSystem/PRD FR-03/product-vision 同步。
- **测试**:前端 vitest 47/47(新增评测页 4 例)、typecheck 干净;后端 pytest 127/127 不变(零后端改动)。
- **待确认项拍板(2026-09-09)**:①拒答卡去数值 → **接受**;②评测页静态快照(动态数据源归 3.3.4)→ **接受**。

### 页面容器宽度决策(2026-09-09,拍板人:王荟茹)

- **决策**:「宽幅居中 + max-width 封顶」——内容容器按页面类型分档:知识问答 960px(输入 + 回答阅读列)、评测 1152px(指标矩阵)、文档库 1152px(文档表格)、关于 880px(阅读型);未登记路由回落 960px。app-shell 按首段路由映射,页内区块(页头/输入区/卡片/表格)共用容器宽度;禁止全宽 Dashboard、禁止内容贴近侧栏。
- **配套**:问答页页头新增一行克制副标题「企业知识助手,基于企业知识库回答问题」(PageHeader 可选 subtitle prop,禁营销文案);DesignSystem 新增 `containers` token(单一事实来源)+ L1 对拍测试(三档齐全/4px 网格/逐值映射/760px 残留扫描)。
- **文件**:app-shell.tsx / page-header.tsx / page.tsx(+测试);DesignSystem/DesignRules/qa-guide 同步。
- **测试**:前端 vitest 58/58(新增 containers 对拍 3 + AppShell 映射 7 + 副标题 1)、typecheck 干净;后端零改动。实机四页 SSR 200 且容器分档正确。

### 问答页垂直节奏决策(2026-09-09,拍板人:王荟茹)

- **决策**:问答页增加「呼吸空间」(页面级,其他页维持现状)——主内容顶部 24px(<1024px)/48px(≥1024px)呼吸空间;页头 → 提问区 24px;各状态区块(空态/加载/回答/拒答/错误)间统一 24px;加载态去掉额外 padding,与结果态同位、不跳动。禁 Hero 式大留白,首屏即可见提问框。
- **实施**:page.tsx 根容器 `gap-4` → `gap-6 pt-6 lg:pt-12`;加载块去 `py-6`;全部使用既有 spacing token(s6/s12,即 Tailwind 4px 网格),未新增 token、未新增组件。
- **测试**:前端 vitest 59/59(新增垂直节奏断言 1)、typecheck 干净;SSR 实测类名生效。
- **附带修复**:vitest 缓存目录与 Next dev server 的 `node_modules/.vite` 冲突(反复出现 "Vitest failed to find the current suite")→ vitest.config.ts 设 Vite `cacheDir: node_modules/.vitest` 分离,双连跑验证稳定。

### 3.3.2 全量交互补齐记录(2026-09-09)

- **后端(引用富数据 + 反馈)**:`_map_citations` 附 `text`(完整 chunk 原文,供来源抽屉)/`source`/`score`(展示口径:hybrid_rerank 显示 rerank 分,其余显示检索分,DesignSystem EvidenceItem 口径);`/api/ask` 响应增加 `qa_id` 并逐引用补齐文档元信息(`doc_title/doc_format/doc_status/doc_uploaded_at`,文档缺失回退 doc_id/空串);新增 `POST /api/qa/{qa_id}/feedback`(FR-12:rating ∈ useful/useless,upsert 落库 qa_feedback 表,QA 不存在 404)。测试:test_api_feedback 3 例新建,test_api_ask/test_answer_pipeline/test_gen_eval 更新至富字段口径,后端 pytest 132/132。
- **前端(3.3.2 全量组件)**:CitationChip(`[n]` mono chip,悬停/聚焦反色,缺失编号灰态 + title 提示,热区 移动端 44/桌面 32);EvidenceItem(编号 chip·文档标题·格式/上传时间·引用片段 evidence-quote 4 行可展开·来源徽标·相关度 mono 2 位·查看原文);SourceDrawer(360px 右滑入 motion.medium 200ms + 遮罩 overlay-light,标题 20px/600,格式·状态·上传时间徽标,完整 chunk 原文可滚动,分数+来源模式,「在文档库中查看」链接,Esc/遮罩关闭);AnswerSheet 重写(正文 `[n]` 标记解析为内嵌 chip,双向联动:悬停 chip ↔ 引用句 brand-50 高亮 ↔ 依据条目 brand-600 描边 + 滚动进入视口,操作行 重新生成 secondary/复制/有用·无用 ghost);问答页回答栈(FR-11:重新生成期间旧回答仍可见,新回答在上)。
- **已知取舍(不隐瞒)**:① Mock Provider 逐字摘录不带 [n] 编号 → 实测页面无内嵌 chip、双向联动暂不可手测(L3 组件测试以固定夹具覆盖,真实 LLM 到位后自然呈现,qa-guide v0.5 已注明);②反馈提交失败静默回退,暂无 Toast 提示组件;③「在文档库中查看」暂链向 /documents 页(文档定位跳转随 3.3.3 文档库页实现)。
- **测试**:后端 pytest 132/132;前端 vitest 79/79(新增:rag.test 反馈 BFF 转发 2 + sendFeedback client 2、answer-sheet.test 全量重写 17、page.test 回答堆叠/加载保留/页面反馈 3);typecheck 干净。L4 走查待人操作(qa-guide v0.5)。
- **下一步**:3.3.3 文档库页 → 3.3.4 评测页全量(运行按钮/运行历史/动态数据)→ 3.3.5 关于页。

## 修订

<!-- 格式:{YYYY-MM-DD 主题} → 背景/现象与根因/实施/验证/已知取舍 -->

{2026-09-09 开发端口固定 3001} → 现象:KnowFlow 默认端口随 3000 是否空闲漂移(3000 被占时 Next 自动落 3001,空闲时回 3000),与 CareerOS(固定 3000)存在抢占风险。实施:人拍板固定 3001——`next dev -p 3001` 与 `next start -p 3001`,显式 -p 时 Next 端口被占即报错退出(EADDRINUSE),不自动切换;README 同步。验证:实测 3001 被占时明确报错且未落 3000;正常 `npm run dev` 监听 3001,页面 200。取舍:无新依赖,纯 Next CLI 标准参数。

{2026-09-09 检索策略迁出问答页} → 现象:问答页顶部暴露「向量/混合/混合+重排」切换,把 RAG 技术细节交给普通用户选择,增加认知负担且偏离「企业知识助手」定位。实施:人拍板——问答页移除切换、固定默认 Hybrid+Rerank(后端默认已是 hybrid_rerank,零后端改动);元信息行与拒答卡去除工程调试值(最高分/耗时/阈值);三模式对比迁移评测页(提前切片:静态快照对比表 + 诚实选型叙事,未实现指标显式「暂无数据」)。验证:vitest 47/47、typecheck 干净、L2 实测三问链路正常(后端零改动,pytest 127/127 不变)。取舍:评测页当前为静态快照(动态数据源随 3.3.4 全量接入);segmented.tsx 组件删除。

{2026-09-09 页面容器加宽分档} → 现象:全局单档 max-w 760px 使问答页在 1440/1920 下内容偏窄、右侧无效留白大,横向空间利用率不足。实施:人拍板「宽幅居中 + max-width 封顶」——DesignSystem 新增 containers token 三档(问答 960 / 评测·文档库 1152 / 关于 880),app-shell 按首段路由映射、未知路由回落 960;页内区块统一容器宽度;问答页页头加一行克制副标题。验证:vitest 58/58(新增 containers 对拍 + AppShell 映射用例)、typecheck 干净、实机四页 SSR 200 且分档正确;1280/1440/1920 三档宽度推演(1440 下问答 960 居中有 104px 两侧边距、评测 1152 全宽;1920 由 max-width 封顶不拉伸)。取舍:容器策略集中于 app-shell(非页面级);1280 下评测容器可用宽度 1008(达不到 1152 上限),表格容器内横向滚动兜底。

{2026-09-09 问答页垂直节奏} → 现象:问答页内容紧贴主内容区顶部(main 无顶部 padding),标题/输入框过早进入视线,缺少从导航进入内容的过渡感。实施:人拍板页面级呼吸空间(其他页维持现状)——根容器 `gap-4` → `gap-6 pt-6 lg:pt-12`(24px <1024px / 48px ≥1024px),页头 → 提问区与各状态区块间统一 24px;加载块去 `py-6` 与结果态同位、不跳动。全部使用既有 spacing token(s6/s12),未新增 token/组件。验证:vitest 59/59(新增垂直节奏断言)、typecheck 干净、SSR 实测类名生效;首屏推演 1280/1440/1920 下提问框均在首屏可见。取舍:垂直节奏为问答页页面级决策,全局 main 的顶部 spacing 未动(避免其他三页整体下移),后续如统一处理需单独拍板。

## 已解决的问题

| # | 问题 | 根因 | 修复 |
| --- | --- | --- | --- |
| 1 | pip 安装报 UnicodeDecodeError(gbk) | requirements.txt 含中文注释,pip 在中文 Windows 以 GBK 解码 UTF-8 失败 | 依赖清单注释改纯 ASCII(2026-09-09,任务 3.1.1) |
| 2 | Vitest 5 不解 TSX(jsx: "preserve") | Next.js 要求 tsconfig jsx=preserve,Vitest 5(rolldown)不转换 JSX,import-analysis 报语法错 | 新增 devDependency @vitejs/plugin-react(Babel 转换)+ 未开 globals 时显式 cleanup 注册(2026-09-09,任务 3.1.2) |
| 3 | Vitest 与 Next dev 缓存目录冲突 | 两者共用 `node_modules/.vite`,dev server 运行中反复出现 "Vitest failed to find the current suite"(setup.ts 语境丢失),清缓存只解一次 | vitest.config.ts 设 Vite `cacheDir: node_modules/.vitest` 与 Next 分离;双连跑验证稳定(2026-09-09) |

## 未解决的问题(遗留,编号滚动)

| # | 问题 | 影响范围 | 处置计划 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 真实 LLM Key 未验证 | RAG 生成链路 | Mock 先行开发;真实 Key 到位后重跑同一样例集(L5 真实模型补充验证);**M2b 挂账两线(要点覆盖率 ≥90%、冲突检测 2/2)与幻觉真检验一并在此重跑验收**(2026-09-09 M2b 带遗留通过时明确) | 挂账 |
| 2 | git remote 未设置/公开与否未定 | 仓库发布 | 已解决(2026-09-08 人拍板:暂不设 remote,仅本地提交;公开决策留待后续) | 已解决 |
| 3 | OCR/多模态文档不支持 | 文档解析范围 | 已入 vision 不做清单(MVP 边界),记录 Future Expansion | 挂账 |
| 4 | 商业 Embedding/Reranker 未对比 | 选型完整性 | 可选:实测达标后做对照实验,不阻塞 MVP | 挂账 |
| 5 | npm audit:next@15 传递依赖 postcss 2 个 advisories(1 moderate/1 high) | 前端依赖 | 修复需升级 next@16(破坏性变更,偏离已拍板选型)→ **待人选型裁决**;本地 demo 不暴露公网,风险低 | 挂账 |
