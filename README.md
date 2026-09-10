# KnowFlow AI

企业 AI 知识助手(RAG 作品集项目):用「向量 + 关键词混合检索 + 重排」从企业知识库给出**带来源引用**的回答,知识库没有答案时**明确拒答**,并附带**可复现的检索质量实测数据**。

> ⚠️ **演示数据声明**:演示知识库为虚构企业 **NovaTech**(约 300 人 SaaS 软件公司)的合成演示数据,全部文档标注 `synthetic: true`。本项目在任何场合不将其描述为真实企业客户或真实商业项目。

## 架构

```
┌──────────┐   HTTP(BFF 同源代理)   ┌─────────────────────────────────────────┐
│  浏览器    │ ────────────────────▶ │  Next.js 15(3001)                       │
│  3001 UI  │ ◀──────────────────── │  · 四页:问答 / 文档库 / 评测 / 关于      │
└──────────┘                        │  · src/app/api/** 代理 → 127.0.0.1:8000 │
                                    └───────────────┬─────────────────────────┘
                                                    │ 127.0.0.1(本地绑定)
                                    ┌───────────────▼─────────────────────────┐
                                    │  FastAPI RAG 服务(8000,rag_service/)    │
                                    │  · ParsingService: md/pdf/docx/html/txt │
                                    │  · IndexingService: 分块 + bge-m3 向量   │
                                    │  · RetrievalService: 混合检索 + 重排     │
                                    │  · AnswerPipeline: 拒答/引用/冲突 + QA 日志│
                                    └───┬──────────┬──────────┬───────────────┘
                                        │          │          │
                              ┌─────────▼──┐  ┌────▼─────┐  ┌─▼───────────────┐
                              │ SQLite      │  │ LanceDB  │  │ runtime/models/  │
                              │ 元数据/QA/  │  │ 向量 +   │  │ bge-m3 ·         │
                              │ 评测/反馈   │  │ 全文倒排 │  │ bge-reranker     │
                              └────────────┘  └──────────┘  └─────────────────┘
```

- 前端:Next.js 15(App Router + TypeScript),端口固定 3001(被占用时明确报错,不自动切换)
- RAG 服务:FastAPI + LanceDB,同仓库 `rag_service/`,仅绑定 127.0.0.1
- 模型:本地 bge-m3(Embedding)+ bge-reranker-v2-m3(Rerank);LLM 适配层,Mock 默认(零 Key 跑通全链路与评测)
- 评测:pytest + Vitest 自动化;Hit@5 / MRR 指标自实现,固定样例集 14 例 7 类场景

## 快速开始(克隆 → 启动 → 评测)

```bash
# 0. 克隆(公开仓库,不含 runtime 数据与模型)
git clone https://github.com/wuhu-1238888/knowflow-ai.git
cd knowflow-ai

# 1. 安装前端依赖
npm install

# 2. 创建并激活 Python 虚拟环境(3.11+)
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash;CMD 用 .venv\Scripts\activate
pip install -r rag_service/requirements.txt

# 3. 配置环境变量(可选;不配置 = LLM_PROVIDER=mock 默认)
cp .env.example .env

# 4. 装载演示数据(幂等;自动建 runtime/ 与数据库:20 篇 NovaTech 文档元数据 + 14 条评测用例)
python -m rag_service.seed

# 5. 解析 + 索引演示文档(首次运行加载 bge-m3,见下「模型下载」;完成后 20 篇 72 分块)
python -m rag_service.index_docs

# 6. 一条命令拉起双进程(concurrently,前端 3001 + RAG 8000;Ctrl+C 级联退出)
npm run dev
```

- 前端:http://localhost:3001 | RAG 健康检查:`curl http://127.0.0.1:8000/health`
- **工作纪律**:只跑一个 dev server(`npm run dev` = 一套环境);build 必须在无 dev server 时执行

### 评测(可选,约 8 分钟)

```bash
# 三模式检索评测(Hit@5/MRR/逐例明细),run JSON 落盘 docs/eval-results/
python -m rag_service.eval_engine

# 生成层全链路评测(14 例 × 默认检索模式,人工核对表;按 LLM_PROVIDER 选择 Mock 或真实模型)
python -m rag_service.gen_eval
```

- 结果解读:检索层指标与选型叙事见 `docs/evaluation-report.md`;每个数值只来自 `docs/eval-results/run-*.json`(文件名含 run-id,评测页矩阵页脚可回溯 run-id 与 params_hash)。
- 也可以在评测页(http://localhost:3001/eval)点「运行评测」一键跑三模式(后台批次执行)。

## 模型下载说明

- 两个模型首次使用时**自动下载**(需联网一次),之后本地加载、零网络:
  | 模型 | 用途 | 约大小 | 位置 |
  | --- | --- | --- | --- |
  | bge-m3 | Embedding(分块向量化) | 4.3 GB | `runtime/models/BAAI/bge-m3/` |
  | bge-reranker-v2-m3 | 重排(检索后精排) | 2.2 GB | `runtime/models/BAAI/bge-reranker-v2-m3/` |
- 加载顺序:检测本地目录存在即直接加载 → 否则走 HuggingFace 自动下载;huggingface.co 直连失败可设 `HF_ENDPOINT=https://hf-mirror.com`(`.env`,HuggingFace 生态标准变量)。
- 网络完全受限的环境:可经 ModelScope 等通道把模型预置到上述目录(目录结构一致即可,代码检测到即零网络加载)。

## 演示与验证

- 演示脚本:`docs/demo-script.md`(≤ 5 分钟核心闭环:上传文档 → 提问 → 核对来源 → 演示一次拒答)
- 演示用上传文档:`docs/demo-data/upload/doc-cafe-01.md`(合成数据,演示后删除恢复 20 篇基线)

## 已知边界(诚实声明)

- **真实 LLM 未验证生成层五线**:默认 Mock Provider 为确定性规则摘句,生成层「要点覆盖率 ≥90% / 幻觉 0 / 引用 0 错误 / 拒答 2/2 / 冲突 2/2」的人工判定在 Mock 下能力受限。真实 Key 到位后:由**人**写入 `.env`(`LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY`),重跑 `python -m rag_service.gen_eval` 同一样例集做 L5 补充验证。AI 不写 Key。
- 流式回答(SSE)/ 暗色模式 / 多租户 / 多模态 OCR:本期不做,记 Future Expansion。
- API 本地绑定、无鉴权,仅用于本地演示。
- npm audit 存在 next@15 传递依赖 advisories(需升级 next@16 修复,破坏性变更待选型裁决);本地演示不暴露公网,风险低。

## 目录结构

```
knowflow-ai/
├── src/                # Next.js 前端(App Router;BFF 代理 src/app/api/**)
├── rag_service/        # Python RAG 服务(FastAPI 单入口 main.py + 模块;含 188 例 pytest)
├── design/             # 设计系统(DesignRules 规则 + DesignSystem token 单一事实来源)
├── docs/               # 演示文档(synthetic)/ 评测夹具 cases.yaml / run JSON / 评测报告 / 演示脚本
├── memory-bank/        # 产品文档(愿景/画像/PRD/架构/AI 设计/技术设计/实施计划/进度)
└── runtime/            # 运行时数据(SQLite/LanceDB/模型/上传文件)——不入库,首次运行生成
```

## 开发命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 一键拉起前端 3001 + RAG 8000(需虚拟环境已激活) |
| `npm test` | 前端 Vitest(168 例) |
| `npm run typecheck` | TypeScript 类型检查 |
| `cd rag_service && pytest` | 后端 pytest(188 例) |
| `python -m rag_service.seed` | 幂等装载演示文档元数据 + 评测集 |
| `python -m rag_service.index_docs` | 批量解析 + 索引(状态回写「已索引」) |
| `python -m rag_service.eval_engine` | 三模式检索评测 → run JSON |
| `python -m rag_service.gen_eval` | 生成层全链路评测 + 人工核对表 |
