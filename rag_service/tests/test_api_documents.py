"""文档管理端点 L2 直连(TestClient + 注入索引/仓库/临时运行目录)。

覆盖:列表分页与 chunk_count / 上传成功 / 非法格式 400 / 空文件 400 /
解析失败 422(行保留 failed)/ 删除(元数据+chunks+向量+上传副本)/ 重建索引
(失败重试)/ FR-09 删除后检索不再命中、重新上传后恢复。
"""

from fastapi.testclient import TestClient

from rag_service.db import init_db
from rag_service.indexing import LanceIndex, Md5Embedder
from rag_service.main import create_app
from rag_service.repository import Repository
from rag_service.retrieval import RetrievalService

DOC_MD = "# 差旅报销制度\n\n出差住宿每晚报销上限 500 元。\n"

FIXED_DOC_A = {
    "id": "doc-a",
    "title": "员工手册",
    "file_type": "md",
    "status": "indexed",
    "uploaded_at": "2026-09-01T00:00:00+00:00",
    "source_path": "D:/demo/doc-a.md",
    "synthetic": 1,
}

FIXED_DOC_B = {
    "id": "doc-b",
    "title": "IT 手册",
    "file_type": "html",
    "status": "parsing",
    "uploaded_at": "2026-09-02T00:00:00+00:00",
    "source_path": "D:/demo/doc-b.html",
    "synthetic": 1,
}


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWFLOW_RUNTIME_DIR", str(tmp_path))
    init_db(db_path=tmp_path / "knowflow.db")
    repo = Repository(db_path=tmp_path / "knowflow.db")
    embedder = Md5Embedder()
    index = LanceIndex(embedder, db_path=tmp_path / "lancedb")
    service = RetrievalService(index, embedder, reranker=None)
    app = create_app(repo=repo, index=index, service=service)
    return TestClient(app), repo, index, service


def upload(client, name: str, content: bytes, mime: str = "text/markdown"):
    return client.post("/api/ingest", files={"file": (name, content, mime)})


def test_list_documents_pagination_and_chunk_count(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    repo.upsert_document(FIXED_DOC_A)
    repo.upsert_document(FIXED_DOC_B)
    repo.add_chunks(
        [
            {"id": "doc-a-0", "doc_id": "doc-a", "text": "chunk 0", "chunk_order": 0},
            {"id": "doc-a-1", "doc_id": "doc-a", "text": "chunk 1", "chunk_order": 1},
            {"id": "doc-b-0", "doc_id": "doc-b", "text": "chunk 0", "chunk_order": 0},
        ]
    )
    resp = client.get("/api/documents")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2 and body["page"] == 1 and body["page_size"] == 20
    by_id = {item["id"]: item for item in body["items"]}
    assert set(by_id) == {"doc-a", "doc-b"}
    assert set(by_id["doc-a"]) == {
        "id", "title", "file_type", "status", "uploaded_at", "synthetic",
        "last_error", "chunk_count",
    }
    assert "source_path" not in by_id["doc-a"]  # 内部路径不出响应
    assert by_id["doc-a"]["chunk_count"] == 2
    assert by_id["doc-b"]["chunk_count"] == 1
    resp = client.get("/api/documents?page=1&page_size=1")
    body = resp.json()
    assert len(body["items"]) == 1 and body["total"] == 2


def test_ingest_success_full_flow(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    resp = upload(client, "travel.md", DOC_MD.encode("utf-8"))
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"doc_id", "title", "file_type", "status", "chunk_count"}
    assert body["doc_id"].startswith("doc-")
    assert body["title"] == "差旅报销制度"
    assert body["file_type"] == "md" and body["status"] == "indexed"
    assert body["chunk_count"] >= 1
    # 元数据行:indexed + 非演示数据;源文件保存至 uploads
    doc = repo.get_document(body["doc_id"])
    assert doc["status"] == "indexed" and doc["synthetic"] == 0
    saved = tmp_path / "uploads" / f"{body['doc_id']}.md"
    assert doc["source_path"] == str(saved) and saved.is_file()
    # chunks 镜像落元数据库(表格分块数来源),向量行数一致
    assert repo.count_chunks(body["doc_id"]) == body["chunk_count"]
    assert index.count_chunks(body["doc_id"]) == body["chunk_count"]


def test_ingest_unsupported_format_400(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    resp = upload(client, "evil.exe", b"MZ", "application/octet-stream")
    assert resp.status_code == 400
    assert "不支持的格式" in resp.json()["detail"]
    assert repo.list_documents() == []


def test_ingest_empty_file_400(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    resp = upload(client, "empty.md", b"")
    assert resp.status_code == 400
    assert repo.list_documents() == []


def test_ingest_parse_failure_keeps_failed_row(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    # md 仅注释:非空字节过 400 检查,解析后文本为空 → 422
    resp = upload(client, "broken.md", "<!-- 仅注释 -->\n".encode("utf-8"))
    assert resp.status_code == 422
    assert "解析失败" in resp.json()["detail"]
    docs = repo.list_documents()
    assert len(docs) == 1
    assert docs[0]["status"] == "failed"  # 行保留,表格可重试
    assert docs[0]["last_error"].startswith("解析失败")  # 失败原因留存
    assert docs[0]["source_path"].startswith(str(tmp_path / "uploads"))


def test_ingest_index_failure_marks_failed_with_last_error(tmp_path, monkeypatch):
    """索引段异常(模型加载/LanceDB 写入)不再卡 parsing:500 + failed + 原因留存。"""
    client, repo, index, service = make_client(tmp_path, monkeypatch)

    def boom(doc_id, text):
        raise RuntimeError("模拟索引写入失败")

    monkeypatch.setattr(index, "index_document", boom)
    resp = upload(client, "travel.md", DOC_MD.encode("utf-8"))
    assert resp.status_code == 500
    assert "索引失败" in resp.json()["detail"]
    doc = repo.list_documents()[0]
    assert doc["status"] == "failed"
    assert doc["last_error"] == "索引失败: RuntimeError"


def test_ingest_oversized_file_400(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    resp = upload(client, "big.md", b"x" * (10 * 1024 * 1024 + 1))
    assert resp.status_code == 400
    assert "文件过大" in resp.json()["detail"]
    assert repo.list_documents() == []


def test_document_detail_returns_meta_preview_and_chunks(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    text = "# 差旅报销制度\n\n出差住宿每晚报销上限 500 元。\n\n## 市内交通\n\n每天报销上限 100 元。\n"
    doc_id = upload(client, "travel.md", text.encode("utf-8")).json()["doc_id"]
    resp = client.get(f"/api/documents/{doc_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {
        "id", "title", "file_type", "status", "uploaded_at", "synthetic",
        "last_error", "chunk_count", "preview", "chunks",
    }
    assert body["id"] == doc_id and body["title"] == "差旅报销制度"
    assert body["status"] == "indexed" and body["last_error"] is None
    assert body["chunk_count"] == len(body["chunks"]) >= 1
    assert "出差住宿每晚报销上限 500 元" in body["preview"]
    # chunks 按原文顺序(id = doc_id-序号),text 为分块原文
    assert [c["order"] for c in body["chunks"]] == list(range(len(body["chunks"])))
    assert all(c["id"].startswith(f"{doc_id}-") for c in body["chunks"])
    assert any("报销" in c["text"] for c in body["chunks"])


def test_document_detail_unknown_404(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    assert client.get("/api/documents/doc-ghost").status_code == 404


def test_document_detail_failed_row_shows_error_no_preview(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    assert upload(client, "broken.md", "<!-- 仅注释 -->\n".encode("utf-8")).status_code == 422
    doc = repo.list_documents()[0]
    resp = client.get(f"/api/documents/{doc['id']}")
    body = resp.json()
    assert body["status"] == "failed"
    assert body["last_error"].startswith("解析失败")
    assert body["chunk_count"] == 0 and body["chunks"] == []


def test_delete_document_removes_everywhere(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    doc_id = upload(client, "expense.md", DOC_MD.encode("utf-8")).json()["doc_id"]
    saved = tmp_path / "uploads" / f"{doc_id}.md"
    assert saved.is_file()
    resp = client.delete(f"/api/documents/{doc_id}")
    assert resp.status_code == 200 and resp.json() == {"deleted": doc_id}
    assert repo.get_document(doc_id) is None
    assert repo.count_chunks(doc_id) == 0
    assert index.count_chunks(doc_id) == 0
    assert not saved.exists()
    assert client.delete(f"/api/documents/{doc_id}").status_code == 404


def test_reindex_retry_after_failure(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    assert upload(client, "broken.md", "<!-- 仅注释 -->\n".encode("utf-8")).status_code == 422
    doc = repo.list_documents()[0]
    assert doc["status"] == "failed"
    # 源文件修复后重试(重建索引端点复用)
    saved = tmp_path / "uploads" / f"{doc['id']}.md"
    saved.write_text("# 修复后的制度\n\n修复内容:报销上限 800 元。\n", encoding="utf-8")
    resp = client.post(f"/api/documents/{doc['id']}/reindex")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "indexed" and body["title"] == "修复后的制度"
    assert repo.get_document(doc["id"])["status"] == "indexed"
    assert repo.count_chunks(doc["id"]) == body["chunk_count"] >= 1
    assert index.count_chunks(doc["id"]) == body["chunk_count"]


def test_reindex_unknown_doc_404(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    assert client.post("/api/documents/doc-ghost/reindex").status_code == 404


def test_reindex_success_clears_last_error(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    assert upload(client, "broken.md", "<!-- 仅注释 -->\n".encode("utf-8")).status_code == 422
    doc = repo.list_documents()[0]
    assert doc["status"] == "failed" and doc["last_error"]
    saved = tmp_path / "uploads" / f"{doc['id']}.md"
    saved.write_text("# 修复后的制度\n\n修复内容:报销上限 800 元。\n", encoding="utf-8")
    assert client.post(f"/api/documents/{doc['id']}/reindex").status_code == 200
    fixed = repo.get_document(doc["id"])
    assert fixed["status"] == "indexed" and fixed["last_error"] is None


def test_fr09_delete_stops_hits_and_reupload_restores(tmp_path, monkeypatch):
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    text = "年会抽奖规则:一等奖三名,二等奖五名。"
    doc_id = upload(client, "raffle.md", text.encode("utf-8")).json()["doc_id"]
    hits = service.search("年会抽奖", mode="hybrid", top_k=5)
    assert any(h.doc_id == doc_id for h in hits)
    assert client.delete(f"/api/documents/{doc_id}").status_code == 200
    # 删除后不再命中
    hits = service.search("年会抽奖", mode="hybrid", top_k=5)
    assert all(h.doc_id != doc_id for h in hits)
    # 重新上传同一内容 → 新 doc_id,命中恢复(FR-09 口径)
    new_id = upload(client, "raffle.md", text.encode("utf-8")).json()["doc_id"]
    hits = service.search("年会抽奖", mode="hybrid", top_k=5)
    assert any(h.doc_id == new_id for h in hits)


def test_fr09_delete_stops_keyword_and_hybrid_hits_with_fts(tmp_path, monkeypatch):
    """删除后全文倒排同样不再召回(FR-09 一致性补全,2026-09-13):
    上传链路已建 FTS;显式 ensure 幂等;删除后 keyword 与 hybrid 两路均不命中。"""
    client, repo, index, service = make_client(tmp_path, monkeypatch)
    text = "年会抽奖规则:一等奖三名,二等奖五名。"
    doc_id = upload(client, "raffle.md", text.encode("utf-8")).json()["doc_id"]
    index.ensure_fts()  # 幂等:已存在则跳过 + optimize
    # 前置:全文路真实命中(证明 keyword 路生效,非空跑)
    keyword_hits = service.search("年会抽奖", mode="keyword", top_k=5)
    assert any(h.doc_id == doc_id for h in keyword_hits)
    hybrid_hits = service.search("年会抽奖", mode="hybrid", top_k=5)
    assert any(h.doc_id == doc_id for h in hybrid_hits)
    assert client.delete(f"/api/documents/{doc_id}").status_code == 200
    # 删除后(含 FTS 倒排刷新):两路均不再召回已删文档
    keyword_hits = service.search("年会抽奖", mode="keyword", top_k=5)
    hybrid_hits = service.search("年会抽奖", mode="hybrid", top_k=5)
    assert all(h.doc_id != doc_id for h in keyword_hits)
    assert all(h.doc_id != doc_id for h in hybrid_hits)
