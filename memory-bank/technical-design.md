# 技术设计(Technical Design)

> 版本:v0.1 | 最后更新:2026-09-08
> 对应阶段:Stage 08 技术设计
> 纪律:选型一旦定下不再随意更换;实施偏差走「补记」不回头改正文。

## 技术选型对比

| 决策点 | 候选 | 优劣 | 结论 | 人确认 |
| --- | --- | --- | --- | --- |
| 架构形态 | A. Next.js 全栈;B. Next.js 前端 + 同仓库 Python RAG 服务;C. 纯 Python(Streamlit) | A 用户熟悉、UI 表现力强,但 RAG 生态弱;C 演示快但 UI 质感与交互上限低;B 各取所长,代价是多一个进程 | **B:Next.js 全栈 + 同仓库 Python RAG 服务(FastAPI 单文件)**,根目录一条命令脚本同时拉起 | 已确认(2026-09-09) |
| 向量库 | pgvector(需 Docker);Qdrant(需 Docker);Chroma(嵌入式,无全文检索);LanceDB(嵌入式文件库,向量+全文一体) | 需 Docker 的方案违背"克隆即可跑";Chroma 需另配 SQLite FTS5;LanceDB 零运维、单文件、原生 hybrid 支持、Python 原生 | **LanceDB**(备选 Chroma+SQLite FTS5) | 已确认(2026-09-09) |
| Embedding 模型 | 本地 bge-m3;商业 API(text-embedding-3-small/智谱/硅基流动);m3e 等旧模型 | bge-m3 中文强、零 Key、离线可复现,与评测"固定同版本"要求一致;商业 API 便宜但需 Key、不可离线 | **本地 bge-m3**(真实 Key 到位后可换商业 API 并重跑同样例集,记遗留) | 已确认(2026-09-09) |
| Reranker | bge-reranker-v2-m3(本地);Cohere rerank(需 Key);不用 reranker | 评测需要第三链路(Hybrid+Rerank),必须选;本地 bge-reranker-v2-m3 与 bge-m3 同生态、中文好 | **本地 bge-reranker-v2-m3** | 已确认(2026-09-09) |
| LLM | 适配层 + Mock 默认;DeepSeek;智谱 GLM;OpenAI 系 | Mock 先行铁律:零 Key 跑通全链路与评测;DeepSeek 国内直连、中文好、便宜,OpenAI 兼容接口;智谱为备选 | **LLM 适配层(可插拔)+ Mock 默认 provider**;真实 provider 首选 DeepSeek,备选智谱 | 已确认(2026-09-09) |
| 文档解析 | PyMuPDF(pdf);pdfplumber;python-docx(docx);Markdown/HTML/TXT 规则清洗 | PyMuPDF 快而稳;pdfplumber 更细但慢;禁 OCR;表格降级为文本流提取并在夹具中验证(记遗留) | **PyMuPDF + python-docx + 规则清洗** | 已确认(2026-09-09) |
| 评测/测试框架 | pytest;指标计算自实现 vs ranx 库 | 指标(Hit@k/MRR)几十行,自实现可展示指标计算代码并进 L1 单测,不引额外依赖 | **pytest + 指标自实现** | 已确认(2026-09-09) |
| API 风格 | 流式 SSE vs 非流式 JSON;REST vs tRPC | 非流式 JSON 评测断言与 Mock 简单(流式记 Future Expansion);Next.js API routes + Python 服务内部 REST | **MVP 非流式 JSON** | 已确认(2026-09-09) |
| 安全 | 无鉴权(本地 demo)vs 简易访问码 | 单用户本地 demo 无需鉴权;访问码无真实安全价值,徒增演示摩擦;SSO/RBAC 记 Future Expansion | **无鉴权,本地绑定 127.0.0.1**;Key 只走 .env 不入库 | 已确认(2026-09-09) |

## 数据模型

核心数据源实体(单点事实来源):Document、Chunk、Index(由 LanceDB 管理)。

| 实体 | 字段 | 说明 |
| --- | --- | --- |
| Document | id, title, file_type, status(parsing/indexed/failed), uploaded_at, source_path | 原始文档元数据;status 驱动 FR-09 列表与状态 |
| Chunk | id, doc_id, text, order, metadata | 分块产物;doc_id 外键;order 保证原文顺序 |
| Index | chunk_id → 向量 + 倒排项 | LanceDB 管理,不建独立表 |
| EvaluationCase | id, category, query, expected_behavior, expected_doc_ids[], expected_chunk_ids[], expected_answer_points[], annotated_by | 评测夹具落库(cases.yaml 为来源) |
| EvaluationRun | id, mode, params_hash, doc_commit, metrics_json, created_at | 评测运行记录;params_hash+doc_commit 保证可复现 |
| QALog | id, query, answer, citations_json, no_answer, mode, created_at | QA 日志(审计最小落点,FR-10) |

**不建**租户/角色/权限字段(ToB 权限层为 Future Expansion,未来在检索与文档模块边界接入)。

## API 层约定

| 端点 | 说明 |
| --- | --- |
| POST /api/ingest | 上传文档 → 解析 → 分块 → 索引;返回 doc_id 与状态 |
| POST /api/ask | `{query, mode}` → `{answer, citations[], no_answer, confidence, conflicts}` |
| GET /api/documents | 文档列表与状态 |
| DELETE /api/documents/:id | 删除文档并移除索引(人显式触发) |
| POST /api/eval/run | `{mode}` → 触发评测,返回 run_id |
| GET /api/eval/runs | 历史评测结果列表 |

- 错误码:400 参数错误 / 404 资源不存在 / 422 解析失败 / 429 限流 / 500 模型或内部异常 / 503 LLM 降级。
- 鉴权:无(本地 demo);流式:无(非流式 JSON);分页:GET /api/documents 与 /api/eval/runs 支持 `?page=&page_size=`,默认 20。
- 超时:ask 单次 30s 上限;ingest 单文档 60s 上限。

## 安全策略

- 演示数据全部标注 `synthetic: true`,不接入真实企业数据;
- API Key 只走 `.env`,不入库;提交前检查敏感信息(CLAUDE.md git 流程第 3 步);
- 服务本地绑定(127.0.0.1),不暴露公网;无鉴权仅适用于本地演示;
- QA 日志含 query 内容,仅本地存储,公开仓库前执行敏感信息复查。

## Future Expansion 技术注记(明确不选/不做,留档)

多租户隔离(库/Schema/行级)、SSO/企业认证、企业级审计日志存储与保留周期、数据导出与合规、OCR/多模态解析、流式回答(SSE)、自训练/微调 Embedding 与 Reranker。以上均不在本期设计,避免过度工程。

## 实施架构决策补记

<!-- 执行期追加;与计划不一致处在此显式标注,不回头改上面已确认的正文。 -->
(暂无)
