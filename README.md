# KnowFlow AI

企业 AI 知识助手(RAG 作品集项目):用「向量 + 关键词混合检索 + 重排」从企业知识库给出**带来源引用**的回答,知识库没有答案时**明确拒答**,并附带**可复现的检索质量实测数据**。

> ⚠️ 演示知识库为虚构企业 **NovaTech**(约 300 人 SaaS 软件公司)的合成演示数据,全部文档标注 `synthetic: true`;本项目在任何场合不将其描述为真实企业客户或真实商业项目。

## 技术栈

- 前端:Next.js 15(App Router + TypeScript)
- RAG 服务:FastAPI + LanceDB(同仓库 `rag_service/`,本地绑定 127.0.0.1)
- 模型:本地 bge-m3(Embedding)+ bge-reranker-v2-m3(Rerank);LLM 适配层,Mock 默认(零 Key 跑通全链路)
- 评测:pytest + 指标自实现(Hit@5 / MRR),固定样例集 14 例 7 类场景

## 快速开始

```bash
# 1. 安装前端依赖
npm install

# 2. 创建并激活 Python 虚拟环境
python -m venv .venv
.venv\Scripts\activate        # Windows(Git Bash:source .venv/Scripts/activate)
pip install -r rag_service/requirements.txt

# 3. 配置环境变量(可选;不配置则使用 Mock 默认)
copy .env.example .env

# 4. 一条命令拉起双进程
npm run dev
```

- 前端:http://localhost:3001(端口固定;被占用时明确报错,不自动切换)
- RAG 服务:http://127.0.0.1:8000(健康检查:`curl http://127.0.0.1:8000/health`)

**工作纪律**:只跑一个 dev server(`npm run dev` = 一套环境);build 必须在无 dev server 时执行。

## 目录结构

```
knowflow-ai/
├── src/app/            # Next.js App Router(四页路由:问答 / 文档库 / 评测 / 关于)
├── rag_service/        # Python RAG 服务(FastAPI 单入口 main.py + 7 模块)
├── design/             # 设计系统(DesignRules.md 规则 + DesignSystem.md token 单一事实来源)
├── docs/               # 演示文档集(synthetic)/ 评测夹具 cases.yaml / 评测结果 run-*.json
├── memory-bank/        # 产品文档(愿景/画像/PRD/架构/AI 设计/技术设计/实施计划)
└── runtime/            # 运行时数据(向量库/模型/数据库)——不入库,首次运行生成
```

## 说明

- 模型首次运行自动下载至 `runtime/models/`(数 GB,需联网一次);huggingface.co 被墙的环境,可设 `HF_ENDPOINT` 走镜像,或将模型经 ModelScope 等通道预置到 `runtime/models/BAAI/bge-m3`(代码检测到本地目录即零网络加载)。
- API Key 只走 `.env`,不入库;服务本地绑定,无鉴权,仅用于本地演示。
- 评测数值只来自 `docs/eval-results/` 的实测 run JSON,禁止虚构。
