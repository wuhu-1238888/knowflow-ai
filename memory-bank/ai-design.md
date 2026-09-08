# AI 能力设计(AI Design)

> 版本:v0.1 | 最后更新:2026-09-08
> 对应阶段:Stage 07 AI/Agent 设计

铁律:**确定性 > 智能**——能算出来的不用模型(排序、归一化、截断、校验用规则;生成、分析用 AI)。

## 「规则 or AI」判定表(按 FR)

| FR | 规则 or AI | 理由 |
| --- | --- | --- |
| FR-01 上传解析 | **规则** | 解析器确定性提取文本(PyMuPDF/python-docx/规则清洗);禁 OCR |
| FR-02 分块索引 | **规则 + AI 模型(确定性推理)** | 分块策略规则化(标题+段落切分、固定窗口与重叠);Embedding 模型产向量,无"判断"风险;三模式评测必须固定同版本 |
| FR-03 混合检索 | **规则 + AI 打分** | 向量检索/BM25/RRF 融合/排序全是确定性计算;Rerank 用 Cross-Encoder 产分数,**排序用规则(分数降序),不信任模型自报的排序标签** |
| FR-04 RAG 问答 | **AI 生成 + 规则组装** | 唯一生成环节交给 LLM;context 组装(top-k 截断 + token 预算上限)用规则 |
| FR-05 Citation | **规则** | 答案片段到被检索 chunk 的编号映射由规则侧完成,**绝不信模型自报的来源**(模型自报 doc/chunk 不可信,必须规则侧核对) |
| FR-06 无答案拒答 | **规则(阈值)** | 检索最高分 < τ 且答案要点无法映射到 chunk → 标准拒答话术。**不用 LLM 判定拒答**,保证可判定验收;τ 初值人拍板、实测校准 |
| FR-07 冲突处理 | **AI 标注 + 规则呈现** | LLM 在输出 schema 中给 conflicts 字段(被引用 chunk 间矛盾);规则侧校验字段合法性并并列呈现双方来源,**不替用户选边** |
| FR-08 评测引擎 | **规则** | 指标计算(Hit@k/MRR)确定性函数,进 L1 单测(手算用例对照) |
| FR-09 文档管理 | **规则** | 状态机 + 删除/重建,无 AI |
| FR-10 QA 日志 | **规则** | 落盘字段,无 AI |
| FR-11 重新生成 | **AI 生成 + 规则** | 复用 FR-04 管线;按钮由用户显式触发 |
| FR-12 复制/反馈 | **规则** | 无 AI |

## 管线组件契约(模板"Agent 契约"适配为管线组件)

| 组件 | 职责 | 输入 | 输出 schema | 失败策略 | 评测方式 |
| --- | --- | --- | --- | --- | --- |
| ParsingService | 5 种文本格式 → 纯文本 | `{file: bytes, filename: string}` | `{doc_id, title, text, warnings: string[]}` | 解析失败 → 报错入日志,不入索引;空文本 → 拒绝并提示 | 固定 5 格式夹具解析断言(L1) |
| IndexingService | chunk → embedding → 向量库 + 倒排索引 | `[{chunk_id, doc_id, text, order}]` | `{indexed_chunks: int, doc_count: int}` | 部分失败 → 本次索引事务回滚并报错 | 幂等性断言:重复执行库状态不变(L1/L2) |
| RetrievalService | 三模式检索 | `{query, mode: vector\|hybrid\|hybrid_rerank, top_k}` | `{chunks: [{chunk_id, doc_id, score, rerank_score?, source: vector\|keyword\|hybrid}]}` | 索引为空 → 返回空列表(触发拒答链路);embedding 异常 → 500 + 日志 | 评测集 12 例命中/排名断言(L5);**数据权限边界:仅检索本知识库索引,禁止跨索引** |
| AnswerPipeline | RAG 问答全链路 | `{query, chunks[]}` | `{answer: string\|null, citations: [{index, doc_id, chunk_id, quote}], no_answer: bool, confidence: number, conflicts: [{doc_a, doc_b, quote_a, quote_b}]\|null}` | LLM 失败 → 重试 1 次 → 仍失败返回标准降级话术;schema 校验失败 → 重试 1 次 → 仍失败按拒答处理并留日志(**审计落点:全字段进 QA 日志**) | 14 例全量 schema 校验 + 人工核对要点/幻觉/拒答(L5);**LLM Mock 先行**(provider 可插拔,零 Key 跑通) |
| EvaluationEngine | 三模式评测 + 指标 | `{mode, cases[]}` | `{run_id, params_hash, per_case: [...], metrics: {hit_at_5, mrr}}` | 单例失败不中断全量,记录 skipped;结果写入 eval-results | 指标计算 L1 单测(手算用例对照) |

## 决策点裁决方式

| 决策点 | AI 建议人裁决 | AI 自动执行 | 理由 |
| --- | --- | --- | --- |
| 拒答(检索分数 < τ) | — | ✔(规则阈值自动) | 可逆、低风险、可判定;**τ 初值与调整由人拍板** |
| 冲突呈现 | — | ✔(并列展示,不选边) | 只呈现不决策 |
| 回答生成 / 重新生成 | — | ✔(读操作,无外部动作) | 重新生成由用户按钮显式触发 |
| 检索模式(生产默认) | ✔ | — | 默认 Hybrid+Rerank 由人在 Stage 08 拍板;评测模式由命令参数控制 |
| 文档删除 / 重建索引 | — | ✔(人显式点击触发) | 不可逆操作须人触发,AI 绝不自动删文档 |
| 模型 / Key / 阈值变更 | ✔ | — | 付费、凭证、评测基线变更一律人裁决 |
| 部署 / 发布 | ✔ | — | SOP 铁律,AI 不自动部署 |

> 工具型注入适配:置信度提示 = 检索分数 + citation 覆盖呈现(引用完整 = 可信、无引用 = 不可信);"逐条接受/拒绝"不适用 RAG 问答,替换为"逐条来源检视 + 回答反馈(有用/无用)";再生成 = FR-11。

## AI 边界清单(绝不自动执行)

1. 删除文档、清空索引(须人显式触发且二次确认)。
2. 修改索引参数(分块策略 / embedding 模型 / 重排模型)——变更须人拍板并重跑评测。
3. 修改评测阈值与样例集标注(定稿后任何改动须人批准 + 记录)。
4. 切换生产 LLM / Embedding provider、写入真实 API Key。
5. 部署、对外发布、公开仓库 push 策略变更。
6. 读取 `D:\CareerOS-AI` 任何文件。
7. 任何外部动作(本期无外部动作面;出现即须人批准)。

## 评测方式总述

- **机制**:SOP/04 L5 固定样例集——14 例(7 类场景)人工标注,作为测试夹具入库(`docs/demo-data/evaluation/cases.yaml`);每次改 Prompt / 换模型 / 改管线后必重跑;断言 = schema 校验 + 与标注一致。
- **三模式对比**:vector / hybrid / hybrid_rerank 同条件实测,输出检索层指标(Hit@5、MRR)+ 生成层人工核对(要点覆盖率/幻觉/引用/拒答/冲突)。
- **LLM Mock 先行**:Mock 为默认 provider,零 Key 跑通全链路与评测;真实 Key 到位后重跑同一样例集(L5 真实模型补充验证)。
- **方案细则**:见 `docs/evaluation-plan.md`(Stage 08 定稿;阈值定义、实验协议、记录约定)。
