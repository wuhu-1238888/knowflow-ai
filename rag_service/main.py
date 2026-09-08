"""KnowFlow AI RAG 服务 — 单一入口(FastAPI)。

7 个模块(解析 / 索引 / 检索 / 问答 / 评测 / 文档管理 / 日志)随实施计划逐步挂载,
当前版本仅提供健康检查;端点清单见 technical-design.md「API 层约定」。
"""

from fastapi import FastAPI

app = FastAPI(title="KnowFlow AI RAG Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "knowflow-rag"}
