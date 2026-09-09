# 实施计划(Implementation Plan)

> 版本:v0.1 | 最后更新:2026-09-09
> 对应阶段:Stage 10 实施计划
> 范围:本计划覆盖 **Phase 3 实施(Stage 11–15)**;Phase 4(Stage 16 演示 / 17 部署 / 18 复盘)按工作流另行执行。

## 头部约定

- 每个任务 = 一次独立工作会话(半天到一天),完成后提交代码并在 progress.md 勾选记录
- 一次只做一个任务;里程碑(M)为可交付检查点,**每个里程碑人拍板后才进入下一段**;基础优先(先最小可用打通链路,「后置增强」排在链路之后)
- 每个编码任务执行 SOP/03 的 11 步循环;验收与 Blocker/遗留判定按 SOP/04
- 工作纪律(CLAUDE.md):只跑一个 dev server(根目录一键脚本 = 一套环境);build 必须在无 dev server 时执行;生成数据库引擎/迁移前停掉 dev server;临时脚本用完即删;测试夹具固定日期/固定数据,不做日期相对锚定;测试随功能提交,不设独立测试阶段

## 任务模板(每个任务固定四段)

```markdown
### 任务 x.y {名称}
- 做什么:{不含代码的开发指令,用产品语言写}
- 依赖:{显式列出,不可跳过}
- 验证:{自动测试(哪几层)+ 手工检查(走查什么)}
- 产出物:{代码文件 + 测试 + 文档更新}

**状态:YYYY-MM-DD 已完成(commit `xxxxxxx`)。偏差记录:①…②…**
```

## 分层测试策略

| 层 | 对象 | 工具 | 必须覆盖 |
| --- | --- | --- | --- |
| L1 纯逻辑 | 解析/分块/RRF/指标/拒答判定/引用映射 | pytest 单测 | 正常 + 边界 + 非法输入 |
| L2 API | FastAPI 端点 + Next.js BFF | pytest + 直连调用 | 成功 + 非法参数 + 资源不存在 + 模型异常降级 |
| L3 UI 组件 | AnswerSheet/CitationChip/表格/模态等 | Vitest + Testing Library | 渲染 + 交互 + 状态分支 |
| L4 UI 页面 | 整页/响应式/设计规则 | 手工走查 + DesignRules 自检清单 | 视觉/间距/375px 无溢出/断点/焦点环 |
| L5 AI 输出 | 检索与生成全链路 | 固定样例集回归(cases.yaml 14 例) | schema 校验 + 与人工标注一致 |

- 细则见 SOP/04;LLM Mock 先行(零 Key 跑通全链路与评测);真实 Key 到位后重跑同一样例集(遗留 1)。
- 测试夹具:cases.yaml + 固定 5 格式解析夹具 + 20 篇演示文档,全部固定内容固定日期。

## 全局原则

1. 先跑通再完善(先最小可用闭环,后置增强排在链路之后)
2. 每步可验证(无验证任务不排期)
3. 数据优先(数据模型先于 UI;核心数据源模块先于消费方)
4. 设计约束优先(UI 决策受 DesignRules/DesignSystem 硬约束,不自由发挥)
5. 小步提交(单任务单会话、单任务单 commit)
6. **评测优先**:纵向核心链路的第一交付物是评测引擎跑出的真实数字——UI 排在 M2 之后
7. 诚信铁律:任何指标数值只来自 run JSON,禁止手填/预估;不达标改管线不改阈值

## 偏差记录约定

与上游文档不一致 → 在本计划显式标注 → **执行以本计划为准,不回头改上游文档** → 阶段末三处同步(计划状态行 / 技术设计补记 / progress.md)。

已登记偏差:

1. **Stage 08「FastAPI 单文件」→ 落实为「单入口 + 按模块拆文件」**:`rag_service/main.py` 单一入口 + 7 个模块文件(解析/索引/检索/问答/评测/文档管理/日志)。理由:模块职责与测试清晰,单文件难以承载 7 模块;不改上游技术设计正文,执行期在技术设计「补记」标注。

## 返工预算(复杂模块预留)

| 风险点 | 触发条件 | 预算 |
| --- | --- | --- |
| 文件解析清洗(PyMuPDF/python-docx 提取质量) | 5 格式夹具断言失败、表格/编码/空白清洗不达标 | 0.5 会话(3.2.2 预留) |
| LanceDB 全文检索 API 不满足 hybrid 需求 | 3.2.3 验证失败 | 1 会话(启用备选:Chroma + SQLite FTS5,Stage 08 已备案) |
| bge-m3 / bge-reranker 首次下载与加载 | 网络中断、体积过大、CPU 推理超 NFR(检索 < 3s) | 0.5 会话(量化/镜像/参数微调) |
| 设计 token 落库映射偏差 | 前端 token 与 DesignSystem 数值不一致 | 0.5 会话(3.1.2 预留,单测比对 front matter) |

## 里程碑

| 里程碑 | 内容 | 验收(人拍板) |
| --- | --- | --- |
| **M1 工程地基** | 一条命令拉起双进程;数据模型就位;设计 token 落库 | 一条命令启动成功;L1 数据层全绿 |
| **M2 评测全链路达标** | 评测引擎三模式指标出炉;**Hybrid+Rerank 检索层达标 + 生成层 5 达标线全过**(M2a 检索层指标 → M2b 生成层达标) | run JSON 实测:Hit@5 ≥ 11/12、MRR ≥ 0.8;生成层要点覆盖率 ≥ 90%、幻觉 0、citation 0 错误、拒答 2/2 且 0 误拒、冲突 2/2;τ 实测校准值报人拍板 |
| **M3 四页可用** | 问答/文档库/评测/关于四页完成,全 API 对接 | L3 组件测试全绿 + L4 逐页走查通过 |
| **M4 演示闭环与报告** | 核心 demo 闭环实测 ≤ 5 分钟;三模式对比评测报告定稿 | 计时口径走查通过;报告每格可回溯 run-id |
| **M5 全量验收交付** | L1–L5 全绿;设计规则自检清单全过;README 从零跑通 | 全局验收锚点两条全部达成 |

## Phase 3.1 工程地基

### 任务 3.1.1 仓库骨架与双进程一键启动
- 做什么:建 Next.js 15(App Router + TypeScript 严格模式)前端与 `rag_service/` Python 服务(单入口 main.py + 7 模块目录);根目录一键脚本(concurrently)同时拉起前端(3000)与 FastAPI(8000,本地绑定 127.0.0.1);`.env.example`(LLM_PROVIDER=mock、DEEPSEEK_API_KEY 空位、MODEL_DIR=runtime/models);Python /health 与前端健康检查;gitignore 覆盖 runtime/、.env、模型文件
- 依赖:Stage 08 选型结论(B)
- 验证:L2 直连:一条命令拉起后前端 200 + /health 200;`.env`/runtime 不入库;L1 无
- 产出物:目录骨架、启动脚本、.env.example、README 快速开始初稿、依赖清单(pyproject/package.json)

**状态:2026-09-09 已完成(commit `ea10794`)。偏差记录:①requirements.txt 注释改纯 ASCII(pip 在中文 Windows 以 GBK 解码 UTF-8 失败);②验证时本机 3000 端口被其他进程占用,Next.js 自动落到 3001,项目默认仍为 3000——**2026-09-09 人拍板修正**:开发端口固定为 3001(`next dev -p 3001`,与 CareerOS 的 3000 隔离;端口被占时明确报错 EADDRINUSE 退出,不自动切换),README 与 start script 同步,commit 见 progress.md。**

### 任务 3.1.2 设计 token 落库 + 应用外壳
- 做什么:把 DesignSystem.md front matter 转为前端 token 模块(CSS variables + Tailwind 映射,单一来源,数值与 front matter 一致);实现应用外壳(侧栏 224px 白底发丝线、品牌标记、四页路由骨架、768–1023px 顶栏、焦点环);基础组件 Button/Input/Badge/EmptyState
- 依赖:3.1.1;DesignSystem.md 定稿
- 验证:L3 基础组件渲染+状态测试;L1 token 一致性比对(脚本对拍 front matter 与 token 文件数值);L4 走查:外壳符合 DesignRules(侧栏/焦点环/无 pill 按钮)
- 产出物:token 模块、app shell、基础组件、测试

**状态:2026-09-09 已完成(commit 见 progress.md Round 3)。** 交付:theme.css(@theme 1:1 映射 front matter)、icons/ui 基础组件(Button/Input/Badge/EmptyState/PageHeader)、AppShell+Sidebar 224px+TopBar 48px(移动抽屉)、四页路由骨架、四套测试(24 用例:token 对拍 12 + 组件/外壳 12)。偏差记录:①字体加载用 @fontsource 本地打包(Inter Variable + Geist Mono)替代 next/font/google——离线/国内网络安全,无构建时 Google 请求;②Vitest 5 在 tsconfig jsx: "preserve"(Next.js 要求)下不解 JSX,新增 devDependency @vitejs/plugin-react(Babel 转换)解决;③theme.css 首版漏 --text-numeric 与 code/micro 字体映射,由对拍测试 L1 捕获后补齐——对拍测试价值已实证;④BrandMark SVG 白色线条改用 var(--color-ink-inverse),src/ 零硬编码 hex(grep 已验)。

### 任务 3.1.3 元数据库与仓库层
- 做什么:SQLite(标准库 sqlite3)落地 Document/Chunk/EvaluationCase/EvaluationRun/QALog 五实体(字段照 Stage 08 数据模型,不含租户/角色);LanceDB 初始化目录(runtime/lancedb);Repository 层;演示文档与评测集装载脚本(导入 20 篇文档元数据 + cases.yaml 14 例)
- 依赖:3.1.1
- 验证:L1 CRUD + 边界(空值/重复 id)+ 幂等断言;数据库文件落在 runtime/(不入库)
- 产出物:schema、repository、装载脚本、测试

**状态:2026-09-09 已完成(commit `639213a`)。** 交付:config.py(路径 env 可覆盖,测试用 KNOWFLOW_RUNTIME_DIR 指向 tmp)、db.py(五表 schema+外键+CHECK 约束,LanceDB 仅初始化目录)、repository.py(CRUD+幂等 upsert+数组字段 JSON 往返+删除级联)、seed.py(20 文档元数据+14 例,固定日期 2026-09-01,幂等)、pytest 21 例全绿。偏差记录:①chunk 表 metadata 缺省 '{}' 与 schema DEFAULT 对齐(调用方可省略);②seed 首次运行前必须 init_db(真实 runtime 目录不存在时 connect 失败,由端到端验证暴露,L1 已补);③UI 四态文档状态 vs 库三态(parsing/indexed/failed)的映射留待 3.3.3 前端实现时处理,库不扩字段。

## Phase 3.2 纵向核心链路

> 顺序说明:先 Mock 适配层,再「解析 → 索引 → 检索」,最后评测引擎与问答管线——**评测引擎是本链路的首个对外交付物(M2),UI 全部排在 M2 之后**。

### 任务 3.2.1 LLM 适配层 + Mock Provider
- 做什么:LLMProvider 可插拔接口(输入 context+query,输出 AnswerSchema);**MockProvider 为默认**:确定性输出(从 context 摘取句子并按规则生成引用编号),保证零 Key 全链路可跑、L5 可断言;真实 provider(DeepSeek)骨架同接口,Key 只从 .env 读,**AI 绝不写 Key**
- 依赖:3.1.3(AnswerSchema 字段对齐 ai-design 管线契约)
- 验证:L1 Mock 输出 schema 单测 + 同输入同输出(确定性)断言
- 产出物:llm_adapter.py、mock_provider.py、deepseek_provider.py(骨架)、测试

**状态:2026-09-09 已完成(commit `afee029`)。** 交付:llm_adapter.py(AnswerDraft/RetrievedChunk/Citation/Conflict dataclass + LLMProvider Protocol + get_provider 工厂)、mock_provider.py(规则摘句:前 3 块各取首完整句 ≤120 字符,引用编号=被摘用顺序,确定性)、deepseek_provider.py(同接口骨架,Key 只读 .env,真实调用待遗留 #1)、测试 7 例(确定性/schema/编号/截断/空输入/跳过空块/工厂),pytest 28/28 绿。偏差记录:①引用编号初版用输入枚举序号,空块被跳过后编号不连续——修正为「被摘用顺序」编号(契约:index=回答中引用序号);②conflicts 恒 None(Mock 不伪造冲突标注,3.2.6 管线规则侧处理)。

### 任务 3.2.2 ParsingService(5 格式解析)
- 做什么:PyMuPDF(pdf)+ python-docx(docx)+ 规则清洗(md/html/txt);提取标题与纯文本,表格降级为文本流,禁 OCR;空文本拒绝并提示;首先生成固定 5 格式解析夹具(PDF/DOCX 各 1 篇由现有 md 文档生成,synthetic 标注保留)——**夹具固定内容固定日期**
- 依赖:3.1.3;docs/demo-data/documents(20 篇)
- 验证:L1 固定 5 格式夹具断言(非空/标题/段落完整);边界:空文件/损坏文件/纯表格文档;**返工预算见上表**
- 产出物:parsing.py、5 格式解析夹具、测试

**状态:2026-09-09 已完成(commit `eae4e75`)。** 交付:parsing.py(parse_file 统一入口→ParseResult{doc_id,title,text,warnings};ParsingError/EmptyTextError 分层失败策略;md 去注释/围栏、txt 跳过 synthetic 标记取题、html 标签剥离+实体反转+表格管道流、pdf PyMuPDF 纯文本、docx Heading 优先取题+真表格降级;_clean_common 空行压缩)、夹具 7 件(rag_service/tests/fixtures/:sample.md/txt/html 手工固定 + sample.pdf/sample.docx/table-only.docx 由一次性脚本生成后脚本即删,固定内容不再重新生成;PDF/DOCX 保留 synthetic 标注)、测试 12 例(5 格式夹具断言+空文件/损坏 pdf/docx/纯表格/不支持扩展名/文件名取 doc_id/20 篇真实演示文档全量可解析),pytest 40/40 绿。偏差记录:①夹具 PDF/DOCX 由专用 sample.md 生成而非演示文档(可控性优先:演示文档较长且无表格,夹具含表格/实体/围栏等边界结构;与演示文档结构对齐的回归由 test_all_demo_documents_parse 覆盖);②PDF 内 synthetic 标注转 marker 行且置于标题之后(PDF 取首非空行为标题,标注在首行会污染标题提取)。

### 任务 3.2.3 IndexingService(分块 + Embedding + 索引)
- 做什么:分块策略规则化(标题+段落切分;单 chunk 上限约 1000 字符;超长强制切分;重叠约 100 字符;参数为常量,改动须人拍板+重跑评测);bge-m3 本地加载(首次运行下载至 runtime/models/);LanceDB 写入(向量列 + 全文倒排,原生 hybrid);幂等(重复索引库状态不变);批量索引 CLI(`python -m rag_service index-docs` 装载 20 篇演示文档)
- 依赖:3.2.2
- 验证:L1 分块单测(短文档/超长段落/空文本/顺序字段);L2 索引后 doc 数=20、每篇 chunk>0、幂等断言;**返工预算:LanceDB 不满足则启用备选 Chroma+SQLite FTS5**
- 产出物:indexing.py、chunker.py、CLI、测试

**状态:2026-09-09 已完成(commit `fc0e736`)。** 交付:chunker.py(标题开新块+段落累积,上限 1000/重叠 100 常量,超长块滑动窗口强制切分)、indexing.py(Embedder Protocol 可插拔;Md5Embedder 确定性测试替身;BgeM3Embedder 本地目录优先/HF 兜底;LanceIndex 幂等写 chunks 表+text 列 FTS 倒排)、index_docs.py(批量索引 CLI,状态回写 indexed)、测试 14 例(chunker 7 + indexing 7),pytest 54/54 绿。L2 实测:20 篇 72 chunks,重跑幂等不翻倍,元数据库 20/20 indexed。偏差记录:①huggingface.co 本机网络不可达且 hf-mirror 当前 308 回源,模型经 ModelScope 一次性预置到 runtime/models/BAAI/bge-m3(预置脚本用完即删),BgeM3Embedder 检测本地目录存在即零网络加载,HF 自动下载路径保留(README/.env.example 已记录);②重叠仅作用于超长块滑动窗口,段落自然边界切分不重叠;③lancedb 0.25 起弃用 create_fts_index,改用 create_index(text, config=FTS());④CLI 层无单测(与 seed 同类口径),Repository 构造参数误用由 L2 真实运行暴露并修复。

### 任务 3.2.4 RetrievalService(三模式检索 + Rerank)
- 做什么:vector(LanceDB 余弦)/ BM25(全文)/ RRF 融合 / bge-reranker-v2-m3 重排;三模式 vector / hybrid / hybrid_rerank;输出 `{chunks:[{chunk_id, doc_id, score, rerank_score?, source}]}`(source ∈ vector|keyword|hybrid);top_k=8、RRF k 值等为常量;空索引返回空列表(触发拒答链路);**数据权限边界:仅检索本知识库索引,禁止跨索引**
- 依赖:3.2.3
- 验证:L1 RRF 融合手算用例对照;L5 评测集 12 例命中/排名断言(与 cases.yaml 标注一致)——初跑允许不达标,但必须产出真实数字,改管线不改阈值
- 产出物:retrieval.py、rrf.py、测试

**状态:2026-09-09 已完成(commit `c71a58d`)。** 交付:rrf.py(RRF_K=60 融合,排名内去重)、retrieval.py(SearchHit{chunk_id,doc_id,text,score,source,rerank_score};BgeReranker 本地目录优先/HF 兜底;RetrievalService 四模式,空索引返回空列表触发拒答链路,_fts_available 守卫)、测试 20 例(rrf 10 + retrieval 10:pytest 70/70 绿)。L2 实测(真实 bge-m3 + bge-reranker-v2-m3,72 chunks):「报销凭证需要哪些材料」四模式均 doc-hr-03/04 置顶,hybrid_rerank 重排后无关 doc-prod-04 压至末位(rr 0.86/0.84/0.32/0.23/0.02)。偏差记录:①lancedb 0.25 中文 FTS 无语言级分词(lang_mapping 无中文),采用 ngram(2,3) tokenizer,实测「报销」「请假」精准命中;②任务定义三模式 → 落实四模式,keyword 保留为独立模式(source 枚举完整,评测可比纯 BM25 基线);③FTS 索引先建后写不自动编入新行 → ensure_fts 固定置于全部写入后并每次 optimize;④lancedb 0.25 起 list_tables() 返回带 .tables 属性的对象而非 list,_table_names() 兼容新旧两版;⑤reranker 模型同 3.2.3 偏差①通道经 ModelScope 预置至 runtime/models/BAAI/bge-reranker-v2-m3(预置脚本已删);⑥L5 评测集断言由 3.2.5 评测引擎统一执行(M2a 达标线 Hit@5≥11/12、MRR≥0.8),本任务以 L1 + L2 真实冒烟为完成证据。**

### 任务 3.2.5 EvaluationEngine + 三模式对比(M2a)
- 做什么:评测引擎:装载 cases.yaml → 三模式同条件运行 → Hit@5/MRR 指标自实现 → run JSON 落盘 docs/eval-results/(入库,含 run_id/params_hash/doc_commit/mode×category 明细)→ 指标矩阵输出;params_hash 冻结(模型版本+分块/检索参数哈希),同参数重跑数值一致
- 依赖:3.2.4
- 验证:L1 指标计算手算用例对照(Hit@5/MRR 各 ≥3 个手算例);L5 全量 12 例 × 3 模式一次,输出指标矩阵;**M2a 验收:Hybrid+Rerank Hit@5 ≥ 11/12 且 MRR ≥ 0.8(实测 run JSON,人复核)**
- 产出物:eval_engine.py、metrics.py、run-*.json、指标矩阵

**状态:未开始。**

### 任务 3.2.6 AnswerPipeline + /api/ask + QA 日志(M2b)
- 做什么:context 组装(top-k 截断 + token 预算约 3000);LLM 生成;citation 规则侧编号映射(**绝不信模型自报来源**,映射失败即该引用灰态);拒答判定 = 规则阈值(检索最高分 < τ,τ 初值建议 0.30,3.2.4 实测分数分布校准后报人拍板);conflicts 字段 LLM 标注 + 规则校验(只认可合法 chunk 引用)并并列呈现;schema 校验失败重试 1 次→仍失败按拒答处理并留日志;QA 日志全字段落库(审计最小落点);FastAPI POST /api/ask(非流式 JSON,30s 超时,错误码按 Stage 08)
- 依赖:3.2.4、3.2.1
- 验证:L1 拒答阈值边界/引用映射/schema 校验单测;L2 四类用例:成功 + 非法参数 400 + 空索引→拒答 + LLM 异常→降级话术;L5 全量 14 例 schema 校验 + 生成层人工核对(要点覆盖率 ≥90%/幻觉 0/citation 0 错误/拒答 2/2 且 0 误拒/冲突 2/2);**M2b 验收:五条达标线全过(实测,人核对)+ τ 校准值拍板**
- 产出物:answer_pipeline.py、ask API、QA 日志落库、测试

**状态:未开始。**

## Phase 3.3 横向功能扩展

### 任务 3.3.1 Next.js BFF 代理层 + 前端 API client
- 做什么:Next.js API routes 代理 /api/ingest、/api/ask、/api/documents、DELETE /api/documents/:id、/api/eval/run、/api/eval/runs 至 FastAPI(127.0.0.1:8000),错误码透传;前端 typed client
- 依赖:3.2.6、3.1.2
- 验证:L2 直连:成功 + 404 + 422 + 服务不可达(前端给出可读错误态)
- 产出物:API routes、client、错误态约定

**状态:未开始。**

### 任务 3.3.2 问答页(核心 UI)
- 做什么:提问区(AskTextarea + Enter 提交 + `/` 聚焦 + QuestionChip 示例问题,来自评测集)+ 检索模式分段切换(默认混合+重排);**AnswerSheet 全套**:元信息行(模式徽标·依据数·最高分·耗时,全 mono)→ AI 回答(眉题渐变点 + 正文 + CitationChip)→ 依据带(EvidenceItem:文档标题/章节/引用片段/来源徽标/分数/查看原文)→ 操作行(重新生成/复制/有用·无用);**双向证据联动**(chip↔引用句↔依据条目);SourceDrawer(完整 chunk 原文 + 元信息 + 分数);NoAnswerCallout(中性灰 + 检索证据行「最高分·阈值·依据 0 条」);ConflictPanel(琥珀徽标 + 等宽等权双卡);生成中态 = 渐变胶囊
- 依赖:3.3.1;DesignSystem AI 特有组件规范 1–6
- 验证:L3 组件测试:CitationChip 渲染/灰态/联动、拒答卡中性灰、冲突双卡等权、模式切换;L4 走查:DesignRules 问答页规则逐条 + 375px 无溢出;FR-11 重新生成(旧回答仍可见)
- 产出物:问答页、AI 组件库、测试

**状态:未开始。**

### 任务 3.3.3 文档库页(上传/列表/管理)
- 做什么:UploadZone(5 格式校验/拖拽/无 OCR 说明);文档表格(标题/格式徽标/状态徽标 4 态/分块数/上传时间/操作);删除 = danger 确认模态(二次确认);重建索引;上传中行内进度
- 依赖:3.3.1
- 验证:L3 上传成功/解析失败徽标分支、删除确认弹窗;L2 集成:ingest→状态流转(parsing→indexed/failed);FR-09 验收:删除后 doc 数减 1 且检索不再命中、重建后恢复
- 产出物:文档库页、测试

**状态:未开始。**

### 任务 3.3.4 评测页(指标矩阵 + 运行历史)
- 做什么:运行评测按钮(primary,运行中禁用+Skeleton);EvalMatrix(行=三模式,列=7 类场景+Hit@5+MRR,数字全 numeric token;混合+重排行 surface-2 底 + 达标徽标;其余行「记录值」caption);RunList(run_id/params_hash/doc_commit 截断/时间/指标/状态徽标,点击展开 per-case 明细);数据来源页脚 caption(run-id + params_hash)
- 依赖:3.3.1;3.2.5
- 验证:L3 矩阵渲染/运行中态/展开明细;L4 走查:数字全 mono、无手填数字、页脚可回溯
- 产出物:评测页、测试

**状态:未开始。**

### 任务 3.3.5 关于页(synthetic 声明)
- 做什么:定位一句话;NovaTech 虚构数据声明卡(中性卡片,正文级排版);技术栈列表(mono);边界说明(不做清单摘要)
- 依赖:3.1.2
- 验证:L4 走查:声明完整、无「真实企业客户」表述
- 产出物:关于页

**状态:未开始。**

## Phase 3.4 集成联动

### 任务 3.4.1 端到端演示闭环(≤5 分钟)
- 做什么:按全局验收锚点口径演练:打开产品 → 上传一篇文档 → 提问 → 获得带引用回答 → 点开来源核对原文 → 演示一次拒答,全程计时;修正摩擦点(如模型首次加载等待、上传后索引延迟提示);定稿演示脚本 docs/demo-script.md
- 依赖:M3 全部
- 验证:**实测计时 ≤ 5 分钟(计时口径按 CLAUDE.md,人现场复核)**
- 产出物:演示脚本、闭环修正

**状态:未开始。**

### 任务 3.4.2 三模式对比评测报告
- 做什么:docs/evaluation-report.md:检索层 ΔHit@5/ΔMRR(三模式增益)、生成层五线、每格标注 run-id;不达标项处置 = 改管线不改阈值并重跑;**只引用 run JSON,禁止手填数字**
- 依赖:M2 数据
- 验证:人逐格核对报告与 run JSON 一致
- 产出物:evaluation-report.md

**状态:未开始。**

### 任务 3.4.3 冲突/删除/再生成联动走查
- 做什么:C13/C14 冲突案例全链路 UI 走查(双卡等权/来源抽屉可点);删除文档后相关案例行为(冲突→单来源或拒答,不得崩溃);FR-11 重新生成历史可见;QA 日志抽查(citations 数组完整)
- 依赖:3.3.2、3.3.3
- 验证:L5 回归全量;L4 走查;FR-10 日志断言
- 产出物:走查记录、修正

**状态:未开始。**

## Phase 3.5 打磨收敛

### 任务 3.5.1 设计规则全站自检
- 做什么:DesignRules「提交前自检清单」10 条逐条执行(grep 硬编码色值/渐变白名单 3 处/pill 白名单/焦点环/tabular-nums);375/768/1024 三断点走查;prefers-reduced-motion;走查结论写入 DesignRules「走查记录」
- 依赖:M3 全部
- 验证:自检清单全部打勾;grep 输出为空(白名单除外)
- 产出物:走查记录、修正

**状态:未开始。**

### 任务 3.5.2 README 定稿 + 从零跑通
- 做什么:README:一条命令启动;模型首次下载说明(bge-m3/reranker 大小与位置);评测运行与报告说明;synthetic 声明;ASCII 架构图;遗留说明(真实 Key 重跑同样例集);「克隆→启动→评测」按 README 从零实操一次(人按 README 独立操作)
- 依赖:3.4 全部
- 验证:人按 README 从零跑通(不含真实 Key)
- 产出物:README.md 定稿

**状态:未开始。**

### 任务 3.5.3 全量回归 + 验收数据整理(M5)
- 做什么:L1–L5 全量回归绿清单;评测 run JSON 归档核对(params_hash/doc_commit 一致);progress.md 遗留清单更新;**M5 验收:全局验收锚点两条全部达成**(14 例 7 类实测达标 + 演示闭环 ≤5 分钟),Blocker/遗留由人按 SOP/04 判定
- 依赖:全部前置任务
- 验证:验收清单逐项打勾,数据全部可回溯
- 产出物:验收清单、progress.md 更新

**状态:未开始。**

## 明确不做 / 延后清单

| 项 | 来源 | 处置 |
| --- | --- | --- |
| 多租户 / RBAC / SSO / 组织架构 / 审批流 | PRD 不做清单 | Future Expansion |
| Agent / Multi-Agent / Memory / Tool Calling | PRD 不做清单 | Future Expansion |
| 多模态 RAG / OCR | PRD 不做清单 | Future Expansion(演示文档限定 5 种文本格式) |
| 自训练 Embedding / Reranker | PRD 不做清单 | Future Expansion |
| 企业系统集成(IM/网盘/CRM) | PRD 不做清单 | Future Expansion(零集成保证克隆即跑) |
| 接入真实企业数据 | vision 边界 | 永久不做(NovaTech synthetic 标注) |
| 复用 CareerOS-AI 任何资产 | 隔离红线 | 永久不做 |
| 流式回答(SSE) | 技术设计 Future Expansion | Future Expansion(本期非流式 JSON) |
| 暗色模式 | DesignSystem 迭代指南 | Future Expansion(token 预留 dark:* 命名空间) |
| 真实 LLM Key 接入 | 遗留 1 | 挂账:Key 到位后由**人**写入 .env,重跑同一样例集(L5 真实模型补充验证) |
| 商业 Embedding/Reranker 对照实验 | 遗留 4 | 挂账:可选对照实验,不阻塞 MVP |
| 部署/发布(Stage 17) | 工作流 Phase 4 | 不在本计划,按 Stage 17 另行执行 |

## 待拍板事项(2026-09-09 人已拍板)

1. ~~拒答阈值 τ 初值 0.30~~ → **已拍板:τ 初值 0.30**;3.2.4 实测检索分数分布后校准,校准值报人拍板定稿。
2. ~~分块/检索常量初值~~ → **已拍板**:chunk ≤ 1000 字符、重叠 100、top_k=8、context ≤ 3000 tokens;执行期可调,调整须人拍板并重跑评测。
3. ~~偏差记录第 1 条~~ → **已拍板**:接受「单入口 + 模块化」落实方式。
