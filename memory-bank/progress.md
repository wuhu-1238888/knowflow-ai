# 开发进度(Progress)

> 版本:v0.1 | 最后更新:2026-09-09
> 对应:执行期持续维护(执行日志)

<!-- 头部:测试基线,随任务更新 -->
- 测试基线:后端 pytest 181/181 + 前端 vitest 133/133(M3 首批任务 + 检索策略产品决策 + 页面容器加宽 + 问答页垂直节奏 + 3.3.2 全量交互补齐 + 3.3.3 文档库页 + 3.3.4 评测页全量 + 3.3.5 关于页 + 3.4.2 三模式对比评测报告后全绿,2026-09-10)

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
| 3.3.3 | 文档库页(上传/列表/删除确认/重建索引) | 已完成(后端 pytest 141/141 + 前端 vitest 114/114 绿;typecheck 干净) | (见下) |
| 3.3.4 全量 | 评测页(运行评测/运行历史/per-case 明细/动态数据源) | 已完成(后端 pytest 149/149 + 前端 vitest 125/125 绿;typecheck 干净;实机三模式真实评测通过) | (见下) |
| 3.3.5 | 关于页(定位一句话/synthetic 声明卡/技术栈 mono/边界说明) | 已完成(前端 vitest 133/133 绿;typecheck 干净;零后端改动;页面 200 实机核对) | (见下) |
| 3.4.1 | 端到端演示闭环(≤5 分钟)与演示脚本定稿 | 已完成(链路逐段实测达标:热态 ≈2.4 分钟/冷态预算 ≈4.0 分钟;demo-script.md v1.0;零代码改动;页面级计时待人现场复核) | (见下) |
| 3.4.2 | 三模式对比评测报告(检索层 Δ 增益 + 生成层五线 + NFR 实测) | 已完成(evaluation-report.md v1.0;DeepSeek 真实调用实现 + 截断实验负结果回退;137 项逐格自检全过;生成层真实验收待用户写 Key) | (见下) |

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

### 3.3.3 文档库页记录(2026-09-09)

- **后端(文档管理四端点)**:`GET /api/documents?page=&page_size=`(分页 + chunk_count 读 SQLite,source_path 不外泄);`POST /api/ingest`(multipart 上传 → uploads/ 落盘 → 同步解析索引;400 不支持格式/空文件;422 解析失败落 failed 行供重建索引);`DELETE /api/documents/{doc_id}`(Lance 向量 + 元数据级联删除,仅清理 uploads/ 内源文件);`POST /api/documents/{doc_id}/reindex`(按源文件重解析重索引)。index_docs 回填 chunks 落库(文档表格分块数不加载向量库)。**附带修复**:upsert_document `INSERT OR REPLACE` → `ON CONFLICT DO UPDATE`——原实现内部先 DELETE 父行,`foreign_keys=ON` 下级联清空 chunks(见已解决问题 #4)。测试:test_api_documents.py 9 例新建(含 FR-09:删除后 hybrid 检索不再命中、重传恢复),pytest 141/141。
- **前端(文档库页)**:UploadZone(5 格式校验/点击+键盘+拖拽三通道/无 OCR 说明/禁用态);DocumentTable(标题/格式徽标/状态徽标 4 态/分块数/上传时间/操作);上传中 = 表格行内乐观行(待索引徽标 + 解析中说明,无全局遮罩);DocStatusBadge(已索引 success/解析中 info/解析失败 danger/待索引 neutral);ConfirmModal(danger 二次确认,遮罩/Esc/取消三通道关闭,处理中锁定);删除/重建索引 icon ghost 按钮(人显式触发);骨架脉动/空态/列表失败错误态。BFF 新增 `POST /api/documents/:id/reindex` 路由。测试:page.test 11 例 + upload-zone 8 例 + confirm-modal 6 例 + rag.test 文档管理 10 例,前端 vitest 114/114、typecheck 干净。
- **实机双链路(2026-09-09)**:GET /api/documents 8000 与 3001 均 20 篇、chunk_count 齐全、source_path 无泄露;multipart 上传 8000/3001 均 200 → 列表 21(synthetic=0);reindex 200;DELETE 8000/3001 均 200 → 列表回 20;**FR-09 实测**:上传后提问「公司咖啡吧可以免费喝咖啡吗?」→ 命中上传文档(0.9775),删除后再问同一问题 → no_answer=True、0 引用;422 纯注释 html → failed 行出现在列表;400 .png 拒绝;测试残留(failed 行/临时文件)已清理,最终 20 篇。
- **偏差记录**:①上传同步解析,未强制单独 60s 上限(BFF 120s 全局超时兜底);②列表 UI 单页拉全(page_size=100,分页 UI 未做,演示规模充足);③解析失败详细错误仅会话内保留(刷新后只剩 failed 行,重建索引重试);④UI 四态(含待索引)与库三态(parsing/indexed/failed)映射:待索引 = 上传瞬间 UI 兜底态,库不扩字段(沿用 3.1.3 偏差记录 ③)。
- **L4 走查**:待人操作(qa-guide-3.3.3.md)。
- **下一步**:3.3.4 评测页全量(运行按钮/运行历史/动态数据)→ 3.3.5 关于页 → 3.4.1 端到端演示闭环。

### 3.3.4 评测页全量记录(2026-09-10)

- **后端(评测三端点 + 运行状态模型)**:`evaluation_runs` 表迁移 `status`(running/completed/failed,CHECK 约束)+ `per_case_json` 列(轻量 `_migrate`,老库 ALTER 补列,历史 CLI 批次语义不变);`Repository.update_run`(白名单局部更新);`eval_engine.start_eval/_run_batch`(先落三行 running → 后台 daemon 线程顺序跑三模式 → 完成/失败回写 + per_case 落库;run JSON 同落 runtime/eval-runs 运行态);端点:`GET /api/eval/runs`(摘要,per_case 不随列表)/`GET /api/eval/runs/{id}`(明细,404「评测运行不存在」)/`POST /api/eval/run`(202;并发控制 = 数据库驱动:存在新鲜 running 行 → 409「已有评测正在运行,请等待完成」;>30 分钟遗留 running → 标记 failed「运行中断(超时未完成)」后放行)。测试:test_api_eval.py 8 例新建(空列表/202 三行同批/新鲜 409/过期放行/明细含 per_case/CLI 无明细/404/failed 携带 error),pytest 149/149。
- **前端(评测页全量重写)**:页头「检索评测」;「评测矩阵」区 = primary「运行评测」按钮(运行中禁用 + 按钮内 16px 细环旋转)+ 动态矩阵(行=最新完成批次三模式,列=逐例明细推导的 7 类场景 + Hit@5 + MRR,混合+重排行 surface-2 底 + 「当前默认」徽标,Recall@K/Precision@K/平均延迟显式「暂无数据」)+ 数据来源页脚(run_id/params_hash/doc_commit/时间,动态取数);「运行历史」区 = 每行模式/状态徽标/时间/params 8 位/commit/Hit@5+MRR/展开,点击展开按需拉取逐例明细(用例/类别/问题/期望行为/首个期望排名/命中/RR,跳过例底部 caption);历史 CLI 批次(has_per_case=false)矩阵仅总指标 + 诚实说明、展开显示「未存逐例明细」说明;运行中矩阵骨架脉动 + 每 5 秒轮询自动刷新;空态/列表失败重试/409 启动错误提示。BFF 新增 `GET /api/eval/runs/[id]` 路由;rag.ts 新增 listEvalRuns/startEvalRun/getEvalRun + 全套类型;icons 新增 IconPlay;format 新增 formatEvalTime。测试:page.test 全量重写 11 例 + rag.test 评测 4 例,前端 vitest 125/125、typecheck 干净。
- **实机双链路(2026-09-10,真实模型)**:经 BFF POST /api/eval/run → 202 {run_ids×3};直连 8000 并发 POST → 409;批次状态轮询:vector/hybrid 约 2 分钟内 completed、hybrid_rerank 约 8 分钟 completed(重排推理慢,已写入 qa-guide 已知非缺陷);指标实测 vector 12/12·MRR 0.9583、hybrid 12/12·0.9028、hybrid_rerank 12/12·0.9583(与历史 CLI 批次一致,params_hash 未变);GET /api/eval/runs/{id} per_case 14 例齐全(hit/rank/rr 正确);404 可读错误;run JSON 落 runtime/eval-runs(运行态,git 未跟踪);历史 9 批 CLI 记录迁移后 has_per_case=false 正常。
- **偏差记录**:①真实评测单批约 8 分钟(模型推理),页面以 5 秒轮询 + 骨架承载,qa-guide 标注「已知非缺陷」;②BFF proxyToRag 将后端 202 归一为 200(成功语义不变,client 以 ok 判断);③选型叙事段去除原硬编码数字(动态矩阵接入后数字只来自最新批次,叙事改为「数值随最新批次实测动态更新,见上方矩阵」);④矩阵只展示最新完成批次,历史批次指标在运行历史行内可见(不做批次切换 UI);⑤测试用「未来时点 created_at」保证新鲜 running 行判定不随真实时钟漂移(409 用例)。
- **L4 走查**:待人操作(qa-guide-3.3.4.md)。
- **下一步**:3.3.5 关于页(synthetic 声明)→ 3.4.1 端到端演示闭环(≤5 分钟)。

### 3.3.5 关于页记录(2026-09-10)

- **前端(关于页全量,零后端改动)**:四区块按 DesignRules 关于页口径实现——①定位一句话(与 product-vision 定稿逐字一致:带来源引用/明确拒答/可复现的检索质量实测数据);②演示数据声明卡(中性卡片:surface 底 + hairline 描边 + rounded-lg + p-6,正文级排版三段:NovaTech 为虚构企业不指向任何真实企业、全部演示文档 synthetic: true 仅用于演示与评测、不接入任何真实企业数据且声明适用于一切场合);③技术栈列表(6 行 mono:前端 Next.js 15/React 19/TypeScript/Tailwind CSS 4、后端 Python/FastAPI/Uvicorn、数据 SQLite/LanceDB(BM25 全文倒排)、检索 bge-m3/bge-reranker-v2-m3、生成 LLM 适配层 Mock 默认 + DeepSeek、解析 PyMuPDF/python-docx/规则清洗——全部与 package.json/requirements.txt/代码实况核对);④产品边界(不做清单摘要 6 条,每条带一句理由)。纯静态服务端组件,无按钮无交互;容器 880px 由 app-shell 既有 `/about` 档承载(零新增 max-w)。
- **测试**:page.test 8 例新建(四区块标题/定位三大承诺/声明完整性/synthetic: true/**全文 grep 级断言无「真实企业客户」「真实商业项目」**/中性卡片样式/技术栈与仓库实况一致/dd 全 mono/边界摘要项),前端 vitest 133/133、tsc 干净。
- **实机(2026-09-10)**:/about 页面 200;HTML 含 synthetic: true、Next.js 15、bge-m3、bge-reranker-v2-m3、LanceDB、DeepSeek API 等关键内容;「真实企业客户」「真实商业项目」零命中。
- **偏差记录**:无。定位句与技术栈口径全部以仓库实况与 memory-bank 定稿为准,未引入任何数字或预估。
- **L4 走查**:待人操作(qa-guide-3.3.5.md)。
- **下一步**:3.4.1 端到端演示闭环(≤5 分钟)→ 剩余遗留(#1 真实 LLM Key 由用户写入 .env、#5 npm audit postcss 待裁决)。

### 3.4.1 端到端演示闭环记录(2026-09-10)

- **实测闭环(真实模型 DeepSeek,经 BFF 3001 同链路,curl 逐段计时)**:打开产品 0.1s → 上传演示文档(docs/demo-data/upload/doc-cafe-01.md,咖啡吧规范,新建合成文档)**首次 61.1s(embedding 冷启动)/ 热态 4.9s**,状态轮询至 indexed → 提问「办公室咖啡吧的咖啡可以免费喝吗?」**36.5s**,no_answer=False、3 条引用全部命中新上传文档(相关度 0.99)、answer 与文档一致 → 点开来源核对:引用 text 与源文档逐字一致(单行比对全 True)→ 拒答「公司有宠物寄养福利吗?」(评测集 C11)**31.4s**,no_answer=True、confidence 0.0015、0 引用。**合计:热态 ≈2.4 分钟;冷态最坏预算 ≈4.0 分钟(61s 上传 + 90s 首问(2026-09-09 M3 实测)+ 31s 拒答 + 60s 人工操作),均 ≤ 5 分钟锚点。**
- **摩擦点修正(零代码改动)**:①模型首载(LLM 约 90s / embedding 约 61s)→ 演示脚本增加「准备阶段预热(计时外)」:演示前问一题消化加载后刷新页面,正式六步从打开产品起计时(不预热也能过,冷态预算 4.0 分钟);②上传后索引延迟提示 → 3.3.3 已实现上传行内「解析中」徽标,上传等待期转正为 RAG 原理讲解时间,不新增提示;③演示重复上传残留 → 脚本含「演示后清理」步骤(删除上传文档恢复 20 篇基线)。本次实测 2 份测试上传已删除,库恢复 20 篇。
- **产出物**:docs/demo-script.md v1.0(准备阶段 + 正式六步逐步动作/台词/预期/时间预算 + 计时复核表 + 应急预案 + 演示后检查清单,含 synthetic 声明台词);docs/demo-data/upload/doc-cafe-01.md(演示上传专用,不入种子库,README 已更新口径)。
- **测试**:零代码改动,测试基线不变(后端 pytest 149/149 + 前端 vitest 133/133)。
- **L4 待人操作**:按 demo-script.md 页面级亲测一遍并现场计时(≥1 次),结论落档 DesignRules 走查记录(3.4.1)。
- **下一步**:3.4.2 三模式对比评测报告 → 剩余遗留(#1 真实 LLM Key 由用户写入 .env、#5 npm audit postcss 待裁决)。

### 3.4.2 三模式对比评测报告记录(2026-09-10)

- **检索层(报告 §2,每格 run-id)**:hybrid_rerank Hit@5 12/12、MRR 0.9583(阈值 11/12、0.8 达标),双锚点批次 164508Z/121215Z 三模式逐格一致 → 可复现性 FR-08 成立;Δ 增益诚实呈现:Vector→Hybrid ΔMRR **-0.0555**(负增益,C05 1→2、C10 2→3)、Hybrid→Rerank **+0.0555**(C05 恢复 1、C10→2)——rerank 的作用是抵消 RRF 融合排序噪声,并给拒答阈值提供分离度最大的口径。
- **性能 NFR(§2.4,不达标如实记录)**:热态检索 ~31s/问(耗时主体 = reranker CPU 推理 24 个候选全文本 ~28s),NFR「检索 <3s」超标约 10 倍;截断优化实验(200 字)MRR 0.9583→0.8542(C04 1→4、C08 1→2),人拍板回退(commit `18a09ef`),检索性能优化另立任务(候选数 3→2 / ONNX 等,须人拍板 + 重跑评测);评测全量 8 分 2 秒 <10 分钟 ✓。
- **生成层(§3)**:Mock 结构事实入档(gen-a761359f66d1);**真实 DeepSeek 重跑完成**(2026-09-10,Key 由人写 .env;最终批次 140445Z,run-id vector gen-f56d71886b18 / hybrid gen-60531f721c17 / hybrid_rerank gen-3c1f950c388f,doc_commit bdb4d58,skipped 0):拒答 2/2 且 0 误拒、12 例回答全部 ≥1 条引用且**正文标记与引用编号三模式 0 错配**、要点机器预检 11/33(必要不充分)、**结构化冲突 C13/C14 三模式各 1 对 = 2/2 且其余 12 例零误报**;生成 NFR 达标(单次调用 2.17–2.63s)。**缺陷修复故事**:125001Z 3 处错位 → `_renumber_markers` 重写 → 130725Z 反而 7/7/9(同块多摘句 ref_map 覆盖)→ `_to_draft` 重复 ref 仅取首个 → 132817Z 0 错配但冲突 0/2(模型散文并列但不输出 conflicts 字段)→ **人拍板规则侧兜底**(`_fallback_conflicts`:答案含冲突表述且引用恰好双方文档 → 补全一对)→ 140445Z 全绿(修复均带单测,pytest 186/186)。
- **报告自检**:137 项程序化核对(报告数字 ↔ run JSON)全部通过;人工逐格核对待人(L4 走查)。
- **测试**:后端 pytest 181/181(DeepSeekProvider 31 例 + gen_eval 工厂化更新),前端零改动 vitest 133/133。
- **L4 待人操作**:按 evaluation-report.md §2.1 逐格打开 run JSON 核对数字;review-2026-09-10T140445Z.md 五线人工判定;demo-script 计时复核表页面级亲测(3.4.1 遗留)。
- **下一步**:3.4.3 机器侧走查已闭环(见下节),剩 L4 页面人工走查 → 检索性能优化(人拍板后另立)→ 遗留 #1 判定侧人工完成即解除。

### 3.4.3 冲突/删除/再生成联动走查记录(2026-09-10,机器侧完成)

- **冲突结构化兜底已入库**(前置条件,3.4.2 拍板):`_fallback_conflicts` 规则侧补全(答案含冲突表述 + 引用恰好双方文档 → 一对冲突;单方/三方不触发防误报),真实重跑 140445Z 冲突 2/2 零误报;测试 test_answer_pipeline 4 例新建,pytest 186/186。
- **QA 日志审计补全**:`qa_logs` 增 `conflicts_json` 列(建表 + `_migrate` ALTER 老库补列,老行 NULL 语义不变);`add_qa_log`/`/api/ask` 落库结构化冲突;测试 test_repository(roundtrip 断言 conflicts_json 与 NULL)、test_api_ask(新例:conflicts 非空落库 + 无冲突 NULL)、test_api_feedback(调用点补齐字段)。
- **API 实测**(2026-09-10,真实 DeepSeek + 全链检索,dev server 重启后):
  - C13「市内交通费每天报销上限是多少?」→ 2 引用(doc-hr-03 × doc-hr-04)+ conflicts 1 对,quote 为双方原文子串(03「地铁、公交」vs 04「地铁、公交、共享单车」);C14 同形态 1 对;
  - 落库核对:conflicts_json 与响应逐字一致,citations_json 2 条完整;拒答行 conflicts_json = NULL / citations_json = [] 语义正确;
  - FR-11:同问两次 → 两个 qa_id、两次均带引用(每次独立生成,重新生成历史可见的 API 侧成立);
  - **删除联动**:DELETE doc-hr-03 → 文档列表 19、C13 重问不崩溃 → 单一来源回答(仅引 doc-hr-04,conflicts = None,兜底不误触发);恢复 = seed + index_docs 全量重建 → 20 篇 / 72 chunks,C13 冲突完整回归(2 引用 + 1 对)。走查前 DB 备份,恢复验证后删除。
- **L4 待人操作(浏览器)**:C13/C14 问答页 ConflictPanel 双卡等权呈现 + 来源抽屉双方可点;重新生成按钮加载期旧回答保留、完成后新卡在上;文档库删除 doc-hr-03 后重问不崩溃(机器侧已证,页面侧一次即可)。

### 3.4.4 重新生成交互优化——回答版本管理(2026-09-10,机器侧完成)

> 人下达(2026-09-10):重新生成后新旧两卡视觉完全平级,无法判断「哪个是当前版本」。要求:「最新回答主卡 + 上一版折叠」,不搞聊天记录式堆叠。

- **版本状态机**(page.tsx 重写):`latest / previous / refusal` 三槽 + phase(idle/asking/regenerating)。每次重新生成 = 真实 `/api/ask`(新 qa_id,无复制旧卡);成功后新版本成为最新主卡,原最新降级「上一版回答」(默认折叠);连续重新生成序号连续 v1→v2→v3(MVP 保留最新+上一版,v1 让位);新问题整体重置结果区。
- **最新主卡**:眉题「AI 回答」+ brand 色「最新」标 + 右侧 `v{n} · 刚刚生成/N 分钟前`(versionAgeLabel/formatAge,now 可注入保证测试确定性);卡内加载态 = 眉题「正在重新生成」+ 单请求单文案「正在重新生成回答…」(不伪造检索/排序/生成多阶段);失败后原回答与版本恢复(内容一直在状态机中)。
- **内容一致边界**:重新生成结果与上一版逐字一致 → 不复制卡片,明确提示「已完成重新生成,本次回答与上一版一致。」(用户能理解:重新生成确实执行了,模型给出相同答案)。
- **上一版折叠**(PreviousAnswer 组件):一行轻量头(chevron + `上一版回答 v{n} · 相对时间`,次级文字、无渐变点无徽标),展开后复用 AnswerSheet previous 变体(眉题「上一版回答」、操作行仅「复制回答」、边框由折叠容器提供)。
- **冲突/引用随版本**:每版本存自身 citations/conflicts;最新冲突面板只在最新卡下渲染(重新生成期间隐藏旧冲突防串版本);旧版本冲突随上一版展开呈现。
- **拒答按版本处理**:重新生成得到拒答 → 拒答卡为当前结果,原回答降级上一版。
- **测试**:vitest 149/149(新增 16:formatAge/versionAgeLabel 7 + AnswerSheet 版本 4 + 页面版本流 7,旧堆叠 2 例重写);typecheck 干净;dev server 热编译无错、页面 200。零新依赖;未动检索策略/评测页/文档库/布局。
- **L4 待人操作(浏览器,约 5 分钟)**:提问 → 验证「AI 回答 · 最新 v1 · 刚刚生成」且无上一版 → 重新生成 → 卡内「正在重新生成回答…」→ 完成后 v2 最新 + 上一版折叠头 → 展开看 v1 → 再重新生成看 v3/v2 → 连续点两次「年假有几天?」验证一致提示(真实 DeepSeek 温度 0.1 通常同文;若出现不同答案属正常,验证不串版本即可)。

### 3.4.5 口径不一致 Trust UX 优化(2026-09-10,机器侧完成)

> 人下达(2026-09-10):「口径不一致」独立大卡与回答平级、不可交互、来源像普通文本,无法理解「哪里冲突/哪两份文档/为何不选边/如何查看」。要求:冲突是 Trust/Evidence 层,不是错误、不是独立业务模块。

- **信息层级重构**:ConflictPanel 不再作为独立卡渲染,内嵌进 AnswerSheet——位置 = 回答正文之后、依据与来源之前(「AI 回答 → 口径差异提示 → 依据与来源」);页面/上一版均不再单独渲染冲突卡。
- **默认轻量 Trust Alert**:小 warning 三角图标 + warning-bg 浅底(禁红色错误样式/大面积橙色),文案「发现 N 份文档存在口径差异」(N=冲突文档去重数)+「不同文档对同一规则存在不同表述,KnowFlow 不替您选边。」+ 「查看冲突来源」入口,**默认不展开来源内容**(回答页不因冲突变长)。
- **手风琴交互**:点「查看冲突来源」展开双方来源卡(再点「收起冲突来源」收起),aria-expanded 可访问;来源卡 = 标题 + 上传时间 + 双方原文摘录(quote 规则侧保证为原文子串;不伪造冲突点自动抽取)+「查看原文」。
- **复用而非新建**:来源富化直接用当前版本的 citations(doc_id 匹配取 doc_title/doc_uploaded_at);「查看原文」打开既有 SourceDrawer(标题/格式/状态/完整 chunk/分数/文档库链接),不新造查看器;无匹配 citation 时降级为 doc_id 纯文本且不显示「查看原文」(不崩溃)。
- **版本绑定**:conflicts 随 AnswerVersion 存储并传入对应 AnswerSheet;page/previous-answer 对 AnswerSheet 加 key=qa_id,冲突展开/反馈/抽屉等组件状态按版本隔离;重新生成加载态自动隐藏旧版本冲突(整卡切换为加载态),杜绝「新回答 + 旧冲突」错位。
- **不误报**:仅后端 conflicts 非空才渲染(140445Z 实测 2/2 且其余 12 例零误报;多来源综合回答 C05/C06/C09/C10 不触发);单来源/无冲突/拒答均不显示。
- **测试**:vitest 155/155(新增 6:ConflictPanel 默认收起/展开收起/富化+抽屉/降级/多对去重计数 + AnswerSheet 冲突位置 DOM 顺序断言);typecheck 干净;dev server 热编译无错、页面 200。零新依赖;未动检索策略/评测页/文档库/布局。
- **L4 待人操作(浏览器,约 3 分钟)**:问 C13「市内交通费每天报销上限是多少?」→ 回答卡内出现轻量提示(默认收起)→ 点「查看冲突来源」→ 两份来源卡带标题/上传时间 → 点「查看原文」滑出抽屉 → 重新生成后确认新版本冲突归属正确;再问「年假有几天?」(无冲突)确认不显示提示。

### 3.4.6 回答操作反馈优化(2026-09-10,机器侧完成)

> 人下达(2026-09-10):点「有用/无用」后页面几乎无变化、点「复制回答」零反馈,用户不知道操作是否成功。要求:按钮选中态为主(非 Toast 轰炸)、真实 Clipboard 结果反馈、失败可读且不暴露技术错误、反馈按 Answer Version 绑定并可持久化恢复。

- **有用/无用选中态**:互斥选中(brand-50 浅底 + brand-800 深紫字 + aria-pressed),每 Answer Version 只保留一个状态;重复点击同一项保持选中、不重复提交(前端 guard,MVP 不做取消);pending 时两键禁用防重复点击(四态:disabled → pending → success/error)。
- **失败恢复 + 轻量提示**:提交失败恢复原选中态 + 按钮旁一行小字「反馈提交失败,请重试」(text-caption danger-text,aria-live,3s 自动消失);技术细节只进 console.warn。不用 Toast、不做按钮变色+Toast+页面提示叠加。
- **复制回答反馈**:仅真实 `navigator.clipboard.writeText` promise 成功后才显示「✓ 已复制」(success-text,1.8s 后恢复「复制回答」);失败/API 不可用 →「复制失败,请重试」(danger-text,同 1.8s 恢复),不暴露 NotAllowedError 等技术错误(只进 console);复制内容 = AI 回答原文(不改既有复制数据契约)。
- **按版本绑定 + 持久化恢复**:反馈始终 POST 到该版本的 qa_id(每次重新生成 = 新 qa_id,天然独立,零数据架构改动);AnswerSheet 挂载时 GET `/api/qa/{id}/feedback` 恢复持久化状态(刷新/展开上一版不丢;404/未评价 → 未选中;读取失败静默不阻塞)。**恢复读取不锁定按钮**(避免回答刚出现时反馈按钮禁用闪烁、吞点击),若用户已在读取完成前提交,以用户提交为准(interactedRef 忽略过期读取结果)。上一版回答同样具备复制+反馈入口(3.4.4「仅复制」由本任务扩展,反馈独立存取不串版本)。
- **后端新增**:GET /api/qa/{qa_id}/feedback(未提交 → rating null;未知 QA → 404),BFF 同路径 GET 代理 + client getFeedback。生成中卡片无操作行 → 失效版本不可反馈(3.4.4 已保证)。
- **测试**:vitest 167/167(新增 12:互斥/防重/挂载恢复/失败恢复+自动消失/previous 按版本绑定/复制成功/被拒/不可用 + getFeedback client 4 + BFF GET 转发;page.test 引入 stubFetchWithFeedback 统一回 null、askCalls 只数业务请求);pytest 188/188(新增 GET 回读 2);typecheck 干净;dev server 重启后实机走通 ask → GET null → POST useful → GET useful → 404。零新依赖;未动检索策略/评测页/文档库/布局。
- **L4 待人操作(浏览器,约 3 分钟)**:提问「年假有几天?」→ 点「有用」变紫底选中、再点「无用」切换 → 点「复制回答」变「✓ 已复制」约 1.8s 后恢复(粘贴验证内容=回答正文)→ 刷新页面确认选中态恢复 → 重新生成后:新版本无选中、展开上一版(若已点过)仍保留自己的选中 → 断网(DevTools Offline)点「有用」→「反馈提交失败,请重试」3s 消失。

### 3.5.1 设计规则全站自检(2026-09-11,机器侧完成)

- 依据 DesignRules「提交前自检清单」11 条逐条执行(grep + 静态核查),**修复合计 7 项**:
  1. 字号 token 化 5 处:`text-[12px]`→`text-code-sm`(citation-chip/evidence-item,front matter 规格)、sidebar 文字标 `text-[16px]`→`text-heading-2`、topbar 文字标 ×2 `text-[14px]`→`text-heading-3`;
  2. confirm-modal `max-w-[400px]`→`max-w-[420px]`(modal 规格 maxWidth 420);
  3. Skeleton 动画:animate-pulse(2s)与 components.skeleton.animation(1.6s ease-in-out)不符 → theme.css 新增 `--animate-skeleton` + keyframes,5 处 Skeleton 迁移;
  4. 生成中胶囊 `px-3 py-1.5 text-body-sm` → `px-2.5 py-[3px] text-caption`(generating-pill 规格 3px 10px caption);
  5. 新建 QuestionChip 组件(components.question-chip 规格直映射:28px/5px 10px/body-sm/hover surface-2+strong 描边),替换问答页示例 chip 的 Button secondary 临时实现——兑现 3.3.2 偏差记录②;
  6. DesignRules pill 白名单补唯一例外:评测页运行按钮内 16px loading 细环 spinner(DesignSystem 状态规范 loading 行本就允许,非胶囊容器);
  7. tokens.test 新增 Skeleton 动画对拍断言 1 例。
- 确认合规(零改动):色值全在 theme.css 映射层;渐变 4 处全白名单;每屏唯一 primary;拒答卡中性灰「依据 0 条」无调试值;冲突面板琥珀等宽双卡;numeric token 覆盖 7 文件;表格 overflow-x-auto;全局 :focus-visible + input 3px focus-ring;动效全 ≤200ms;prefers-reduced-motion 全局;emoji 扫描仅「✓ 已复制」(3.4.6 人拍板文案文字符);container 映射由 tokens.test 对拍;button.tsx `text-[14px]` = components.button-* typography {14,500,1.3} 直映射、badge `h-[22px]` = badge-base 规格,均非违规。
- 验证:vitest 168/168(+1)、typecheck 干净、四页 SSR 200、grep 复查仅剩规格直映射。
- **待人浏览器走查**:375/768/1024 三断点视觉复核 + prefers-reduced-motion 实景观感(清单 ⑦⑨ 视觉部分);走查记录已写入 DesignRules「走查记录」2026-09-11 条。

### 3.5.2 README 定稿 + 从零跑通(2026-09-11,机器侧完成)

- README.md 定稿,覆盖任务要求的全部要素:一条命令启动(`npm run dev`,需虚拟环境已激活);模型首次下载说明(bge-m3 4.3GB / bge-reranker-v2-m3 2.2GB,位置 runtime/models/BAAI/,本地目录优先零网络加载,HF_ENDPOINT 镜像与 ModelScope 预置通道);评测运行与报告说明(`python -m rag_service.eval_engine` 三模式 + `gen_eval` 生成层,run JSON 落盘 docs/eval-results/,解读见 evaluation-report.md,数值只来自 run JSON);synthetic 声明(顶部);ASCII 架构图(浏览器 → Next.js BFF 3001 → FastAPI 8000 → SQLite/LanceDB/模型);遗留说明(真实 Key 由人写 .env 后重跑 gen_eval 同一样例集,L5 五线人工判定;AI 不写 Key);开发命令表。
- 从零实操路径固定为:clone → npm install → venv+pip → (可选 .env)→ seed → index-docs → npm run dev → (可选)评测,与工作纪律一致(seed/index 在 dev server 启动前执行,避免 SQLite/LanceDB 并发写入);seed 与 index_docs 均内置 init_db(从零无手工建库步骤)。
- 机器侧验证:全部 CLI 命令与 argparse 签名逐一核对;`python -m rag_service.seed` 实测两次(20 篇/14 例,幂等,临时 DB 验证后即删);eval_engine/index_docs/gen_eval 命令与既往任务实际执行完全一致(未变);dev 脚本已由运行中的 dev server 证明。
- **待人操作:「克隆→启动→评测」按 README 从零实操一次(不含真实 Key)**——任务验证口径。

### 3.5.3 全量回归 + 验收数据整理(M5,2026-09-11 机器侧完成)

**L1–L5 全量回归绿清单(2026-09-11 实测)**

| 层 | 结果 |
| --- | --- |
| L1/L2 后端 | pytest **188/188**(含 API 层测试),2 warnings |
| L3 前端组件 | vitest **168/168**(14 文件) |
| 类型 | typecheck 干净 |
| 冒烟 | 四页 SSR 200(问答/文档库/评测/关于) |
| L4 页面走查 | 3.5.1 机器侧自检通过;视觉项待人复核(累计待走查:3.4.3 / 3.4.4 / 3.4.5 / 3.4.6 / 3.5.1 三断点) |
| L5 评测 | 检索层锚点批次见下;生成层五线人工判定待人(review-140445Z) |

**run JSON 归档核对(2026-09-11)**

- 检索 run JSON 18 个(6 批 × 3 模式):**params_hash 全部 = `365740ee216243e4`,当前重算完全一致** → 分块/检索/模型常量零变更;doc_commit 逐批对应仓库状态(fe2ebd0 → 1ebfa52 → 6190456 → 9ac3f84 → b7527fc → 18a09ef)。
- 锚点批次:164508Z(doc_commit `9ac3f84`)与 121215Z(`18a09ef`),报告每格 run-id 可回溯;自 `18a09ef` 以来 docs/demo-data/documents 与 evaluation/cases.yaml **零变更** → 锚点文档集仍有效。
- 截断实验批次(115419Z)及其 params_hash 盲点已在 evaluation-report §2.4 如实记录(回退后复跑,非隐蔽丢弃)。
- gen JSON 15 个(5 批 × 3 模式);末批 140445Z:provider=DeepSeekProvider、params_hash 一致、doc_commit `bdb4d58`;review 核对表 4 份,末份 140445Z 待人工判定。

**全局验收锚点(数据全部来自 run JSON / 实测,无虚构)**

- **锚点 1(最小评测集 7 类场景全部实测达标)**:
  - 检索层(12 例命中口径,7 类全覆盖):hybrid_rerank **Hit@5 12/12(≥11/12)、MRR 0.9583(≥0.8)**——run-24c53e2a5f0a(121215Z),与基线 run-1210ff838c34(164508Z)逐格一致(FR-08 可复现);对照 vector 12/12·0.9583、hybrid 12/12·0.9028。
  - 生成层:拒答 2/2 且 0 误拒、结构化冲突 2/2 零误报、引用编号 0 错配(140445Z 机器预检,DeepSeek 真实模型);**要点覆盖率 ≥90% 与幻觉 0 两线 = 人工判定(review-2026-09-10T140445Z.md),判定完成前锚点 1 不算完全达成**。
- **锚点 2(核心 demo 闭环 ≤5 分钟)**:3.4.1 机器逐段实测——热态合计 ≈2.4 分钟、冷态最坏预算 ≈4.0 分钟,均 ≤5 分钟(demo-script.md v1.0);**页面级计时待人现场复核**(现场逐段掐表)。

**Blocker / 遗留(按 SOP/04 由人判定)**

- 机器侧无 Blocker。
- 人工待办(收口 M5 的四个动作):① 五线人工判定 review-140445Z;② demo 页面级计时现场复核;③ L4 走查清单(3.4.3–3.4.6 四份 + 3.5.1 三断点);④ 3.5.2 从零实操。全部完成后由人拍板 M5。

## 修订

<!-- 格式:{YYYY-MM-DD 主题} → 背景/现象与根因/实施/验证/已知取舍 -->

{2026-09-09 开发端口固定 3001} → 现象:KnowFlow 默认端口随 3000 是否空闲漂移(3000 被占时 Next 自动落 3001,空闲时回 3000),与 CareerOS(固定 3000)存在抢占风险。实施:人拍板固定 3001——`next dev -p 3001` 与 `next start -p 3001`,显式 -p 时 Next 端口被占即报错退出(EADDRINUSE),不自动切换;README 同步。验证:实测 3001 被占时明确报错且未落 3000;正常 `npm run dev` 监听 3001,页面 200。取舍:无新依赖,纯 Next CLI 标准参数。

{2026-09-09 检索策略迁出问答页} → 现象:问答页顶部暴露「向量/混合/混合+重排」切换,把 RAG 技术细节交给普通用户选择,增加认知负担且偏离「企业知识助手」定位。实施:人拍板——问答页移除切换、固定默认 Hybrid+Rerank(后端默认已是 hybrid_rerank,零后端改动);元信息行与拒答卡去除工程调试值(最高分/耗时/阈值);三模式对比迁移评测页(提前切片:静态快照对比表 + 诚实选型叙事,未实现指标显式「暂无数据」)。验证:vitest 47/47、typecheck 干净、L2 实测三问链路正常(后端零改动,pytest 127/127 不变)。取舍:评测页当前为静态快照(动态数据源随 3.3.4 全量接入);segmented.tsx 组件删除。

{2026-09-09 页面容器加宽分档} → 现象:全局单档 max-w 760px 使问答页在 1440/1920 下内容偏窄、右侧无效留白大,横向空间利用率不足。实施:人拍板「宽幅居中 + max-width 封顶」——DesignSystem 新增 containers token 三档(问答 960 / 评测·文档库 1152 / 关于 880),app-shell 按首段路由映射、未知路由回落 960;页内区块统一容器宽度;问答页页头加一行克制副标题。验证:vitest 58/58(新增 containers 对拍 + AppShell 映射用例)、typecheck 干净、实机四页 SSR 200 且分档正确;1280/1440/1920 三档宽度推演(1440 下问答 960 居中有 104px 两侧边距、评测 1152 全宽;1920 由 max-width 封顶不拉伸)。取舍:容器策略集中于 app-shell(非页面级);1280 下评测容器可用宽度 1008(达不到 1152 上限),表格容器内横向滚动兜底。

{2026-09-09 问答页垂直节奏} → 现象:问答页内容紧贴主内容区顶部(main 无顶部 padding),标题/输入框过早进入视线,缺少从导航进入内容的过渡感。实施:人拍板页面级呼吸空间(其他页维持现状)——根容器 `gap-4` → `gap-6 pt-6 lg:pt-12`(24px <1024px / 48px ≥1024px),页头 → 提问区与各状态区块间统一 24px;加载块去 `py-6` 与结果态同位、不跳动。全部使用既有 spacing token(s6/s12),未新增 token/组件。验证:vitest 59/59(新增垂直节奏断言)、typecheck 干净、SSR 实测类名生效;首屏推演 1280/1440/1920 下提问框均在首屏可见。取舍:垂直节奏为问答页页面级决策,全局 main 的顶部 spacing 未动(避免其他三页整体下移),后续如统一处理需单独拍板。

{2026-09-11 有用/无用反馈选中态不显示} → 现象:用户实测「复制回答」反馈正常,但点「有用/无用」按钮毫无选中视觉变化(疑似反馈未成功)。根因:纯 UI 层问题——DB 中 qa_feedback 已存在用户 POST 的 useful 记录(16:11/16:17 两笔),链路与落库全部正常;Button 组件为纯字符串拼接 className(无 tailwind-merge),选中 className `bg-brand-50 text-brand-800` 与 ghost variant 的 `bg-transparent text-ink-2` 平级冲突,CSS 样式表顺序决定胜负,选中类从未生效。实施:选中态改用 `aria-pressed:` 变体(`aria-pressed:bg-brand-50 aria-pressed:text-brand-800 aria-pressed:hover:bg-brand-100`)——属性选择器 `[aria-pressed="true"]` 特异性(0,2,0)高于基础 variant 类(0,1,0),必然覆盖 ghost 样式;复制按钮同理改 `data-[copied=true]:text-success-text` / `data-[failed=true]:text-danger-text`(复制此前能正常显示因状态文案变更+图标切换不依赖颜色类,颜色类同样存在此冲突,一并修正)。验证:编译后 CSS 实测含 5 条目标规则(aria-pressed ×3 + data-copied ×1 + data-failed ×1,属性选择器形态正确);vitest 167/167(断言同步更新为变体类名);typecheck 干净;零新依赖。取舍:不动 Button 组件引入 tailwind-merge(全局改动面大),按需用属性变体兜底同类冲突。

## 已解决的问题

| # | 问题 | 根因 | 修复 |
| --- | --- | --- | --- |
| 1 | pip 安装报 UnicodeDecodeError(gbk) | requirements.txt 含中文注释,pip 在中文 Windows 以 GBK 解码 UTF-8 失败 | 依赖清单注释改纯 ASCII(2026-09-09,任务 3.1.1) |
| 2 | Vitest 5 不解 TSX(jsx: "preserve") | Next.js 要求 tsconfig jsx=preserve,Vitest 5(rolldown)不转换 JSX,import-analysis 报语法错 | 新增 devDependency @vitejs/plugin-react(Babel 转换)+ 未开 globals 时显式 cleanup 注册(2026-09-09,任务 3.1.2) |
| 3 | Vitest 与 Next dev 缓存目录冲突 | 两者共用 `node_modules/.vite`,dev server 运行中反复出现 "Vitest failed to find the current suite"(setup.ts 语境丢失),清缓存只解一次 | vitest.config.ts 设 Vite `cacheDir: node_modules/.vitest` 与 Next 分离;双连跑验证稳定(2026-09-09) |
| 4 | ingest 成功后 repo 分块数为 0(响应 chunk_count=1 但 SQLite 空) | `INSERT OR REPLACE` 内部先 DELETE 父行再插入,`PRAGMA foreign_keys=ON` 下级联删除 chunks——每次 parsing→indexed 状态回写都清掉刚写入的分块 | upsert_document 改 `INSERT ... ON CONFLICT(id) DO UPDATE SET`;test_api_documents 9 例全量覆盖状态回写路径(2026-09-09,任务 3.3.3) |

## 未解决的问题(遗留,编号滚动)

| # | 问题 | 影响范围 | 处置计划 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 真实 LLM Key 未验证 | RAG 生成链路 | **部分解决(2026-09-10,3.4.2)**:Key 由人写入 .env,DeepSeek 真实重跑完成——最终批次 140445Z 三模式 0 错配、拒答 2/2 且 0 误拒、结构化冲突 2/2 零误报、生成 NFR 2.17–2.63s 达标,引用编号缺陷两轮修复全程带单测。**剩余 = 要点覆盖率 ≥90% 与幻觉 0 两线人工判定(review-2026-09-10T140445Z.md),归 M5 人判定** | 部分解决(挂账五线判定) |
| 2 | git remote 未设置/公开与否未定 | 仓库发布 | 已解决(2026-09-09:origin → github.com/wuhu-1238888/knowflow-ai 公开仓库,main 跟踪 origin/main,完整历史推送;自动提交+推送纪律入 CLAUDE.md v0.2) | 已解决 |
| 3 | OCR/多模态文档不支持 | 文档解析范围 | 已入 vision 不做清单(MVP 边界),记录 Future Expansion | 挂账 |
| 4 | 商业 Embedding/Reranker 未对比 | 选型完整性 | 可选:实测达标后做对照实验,不阻塞 MVP | 挂账 |
| 5 | npm audit:next@15 传递依赖 postcss 2 个 advisories(1 moderate/1 high) | 前端依赖 | 修复需升级 next@16(破坏性变更,偏离已拍板选型)→ **待人选型裁决**;本地 demo 不暴露公网,风险低 | 挂账 |
