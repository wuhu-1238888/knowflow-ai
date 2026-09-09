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
        "id", "title", "file_type", "status", "uploaded_at", "synthetic", "chunk_count",
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
    assert docs[0]["source_path"].startswith(str(tmp_path / "uploads"))


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
