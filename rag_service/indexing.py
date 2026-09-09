"""IndexingService:分块 → Embedding → LanceDB 写入(向量列 + 全文倒排)。

设计要点:
- Embedder 可插拔(Protocol):真实 BgeM3Embedder 零 Key 本地加载(首次运行下载至
  runtime/models/);测试注入 Md5Embedder(确定性,md5 → 8 维浮点)。
- LanceDB 单表 chunks:{chunk_id, doc_id, text, chunk_order, vector};
  chunk_id = f"{doc_id}-{order}"(确定性,重复索引状态不变)。
- 幂等:index_document 先按 doc_id 删除旧行再写入,同文档同模型重复执行结果一致。
- 全文倒排:FTS 索引建于 text 列(hybrid 检索依赖,3.2.4 消费)。
"""

import hashlib
import os
from pathlib import Path
from typing import Protocol

import lancedb
import pyarrow as pa
from lancedb.index import FTS

from .chunker import chunk_text
from .config import get_lancedb_dir, get_models_dir

TABLE_NAME = "chunks"
BGE_M3_DIM = 1024


class Embedder(Protocol):
    dim: int

    def embed(self, texts: list[str]) -> list[list[float]]:
        """文本列表 → 等长向量列表(dim 一致)。"""
        ...


class Md5Embedder:
    """确定性假 Embedder(测试用):md5 摘要 → 8 维浮点向量,同文本必同向量。"""

    dim = 8

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for text in texts:
            digest = hashlib.md5(text.encode("utf-8")).digest()
            vectors.append([b / 255.0 for b in digest[: self.dim]])
        return vectors


class BgeM3Embedder:
    """本地 bge-m3(FlagEmbedding):优先 runtime/models/ 本地目录,否则 HF 自动下载。"""

    dim = BGE_M3_DIM
    MODEL_NAME = "BAAI/bge-m3"

    def __init__(self) -> None:
        # 缓存目录必须在加载 huggingface 库之前指向 runtime/models/
        os.environ.setdefault("HF_HOME", str(get_models_dir() / "huggingface"))
        from FlagEmbedding import BGEM3FlagModel  # 延迟导入:测试不依赖真实模型

        local_dir = get_models_dir() / "BAAI" / "bge-m3"
        # 本地目录存在(如经 ModelScope 等通道预置)则直接加载,零网络
        model_ref = str(local_dir) if local_dir.is_dir() else self.MODEL_NAME
        self._model = BGEM3FlagModel(model_ref, use_fp16=False)

    def embed(self, texts: list[str]) -> list[list[float]]:
        out = self._model.encode(texts, return_dense=True, batch_size=8)
        return out["dense_vecs"].tolist()


def _schema(dim: int) -> pa.Schema:
    return pa.schema(
        [
            pa.field("chunk_id", pa.string()),
            pa.field("doc_id", pa.string()),
            pa.field("text", pa.string()),
            pa.field("chunk_order", pa.int32()),
            pa.field("vector", pa.list_(pa.float32(), dim)),
        ]
    )


def _quote(value: str) -> str:
    return value.replace("'", "''")


class LanceIndex:
    """LanceDB chunks 表封装:建表/幂等写入/FTS 索引/统计。"""

    def __init__(self, embedder: Embedder, db_path: Path | None = None) -> None:
        self._embedder = embedder
        self._db = lancedb.connect(str(db_path or get_lancedb_dir()))
        self._table = None

    def _ensure_table(self):
        if self._table is None:
            if TABLE_NAME in self._db.table_names():
                self._table = self._db.open_table(TABLE_NAME)
            else:
                self._table = self._db.create_table(
                    TABLE_NAME, schema=_schema(self._embedder.dim)
                )
        return self._table

    def ensure_fts(self) -> None:
        """text 列全文倒排(hybrid 检索依赖);已存在则跳过。"""
        table = self._ensure_table()
        index_types = [str(idx.index_type).upper() for idx in table.list_indices()]
        if "FTS" not in index_types:
            table.create_index("text", config=FTS())

    def index_document(self, doc_id: str, text: str) -> int:
        """分块+嵌入+幂等写入;返回写入 chunk 数(空文本=0)。"""
        chunks = chunk_text(text)
        if not chunks:
            return 0
        vectors = self._embedder.embed([c.text for c in chunks])
        table = self._ensure_table()
        table.delete(f"doc_id = '{_quote(doc_id)}'")
        rows = [
            {
                "chunk_id": f"{doc_id}-{chunk.order}",
                "doc_id": doc_id,
                "text": chunk.text,
                "chunk_order": chunk.order,
                "vector": vector,
            }
            for chunk, vector in zip(chunks, vectors)
        ]
        table.add(rows)
        return len(rows)

    def count_chunks(self, doc_id: str | None = None) -> int:
        table = self._ensure_table()
        df = table.to_pandas()
        if doc_id is not None:
            return int((df["doc_id"] == doc_id).sum())
        return len(df)

    def list_doc_ids(self) -> list[str]:
        table = self._ensure_table()
        df = table.to_pandas()
        return sorted(df["doc_id"].unique().tolist())

    def list_chunks(self, doc_id: str | None = None) -> list[dict]:
        """按 chunk_order 升序返回行(doc_id 为空则全表);演示规模下 to_pandas 足够。"""
        table = self._ensure_table()
        df = table.to_pandas()
        if doc_id is not None:
            df = df[df["doc_id"] == doc_id]
        return df.sort_values("chunk_order").to_dict("records")
