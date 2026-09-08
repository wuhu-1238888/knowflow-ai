"""L1:装载脚本——20 篇文档元数据 + 14 例评测集,幂等,固定日期。"""

from rag_service.seed import (
    SEED_UPLOADED_AT,
    derive_title,
    load_cases,
    load_documents,
    seed,
)


def test_load_documents_returns_20_with_stable_ids():
    docs = load_documents()
    assert len(docs) == 20
    ids = [d["id"] for d in docs]
    assert len(set(ids)) == 20
    assert "doc-hr-05" in ids
    assert all(d["synthetic"] == 1 for d in docs)
    assert all(d["uploaded_at"] == SEED_UPLOADED_AT for d in docs)
    assert all(d["status"] == "parsing" for d in docs)


def test_load_documents_covers_five_formats():
    types = {d["file_type"] for d in load_documents()}
    assert types == {"md", "txt", "html"}  # pdf/docx 由 3.2.2 夹具生成后再纳入


def test_derive_title_md_html_txt():
    md = "<!-- synthetic: true -->\n\n# NovaTech 请假制度\n\n正文"
    assert derive_title(md, "doc-hr-05.md") == "NovaTech 请假制度"
    html = "<html><head><title>NovaFlow 云平台产品总览</title></head></html>"
    assert derive_title(html, "doc-prod-01.html") == "NovaFlow 云平台产品总览"
    txt = "synthetic: true | NovaTech 虚构演示文档\n\nNovaTech 账号申请与密码管理\n正文"
    assert derive_title(txt, "doc-it-01.txt") == "NovaTech 账号申请与密码管理"


def test_load_cases_returns_14_seven_categories():
    cases = load_cases()
    assert len(cases) == 14
    categories = {c["category"] for c in cases}
    assert len(categories) == 7
    behaviors = {c["expected_behavior"] for c in cases}
    assert behaviors == {"answer", "refuse", "conflict"}
    assert all(c["annotated_by"] for c in cases)


def test_seed_idempotent_and_persists(tmp_env, repo):
    stats1 = seed(db_path=repo._db_path)
    assert stats1 == {"documents": 20, "cases": 14}
    # 重复装载:统计不变、行数不翻倍(覆盖)
    stats2 = seed(db_path=repo._db_path)
    assert stats2 == stats1
    assert len(repo.list_documents()) == 20
    assert len(repo.list_cases()) == 14
    # 装载后的文档标题来自文档内容(非文件名兜底)
    assert repo.get_document("doc-hr-05")["title"] == "NovaTech 请假制度"
