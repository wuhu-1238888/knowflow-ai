"""DeepSeekProvider L1 单测:prompt 组装 / JSON 提取与映射 / 错误传播。

HTTP 层用 monkeypatch 打桩(替换 _chat_completion 或 httpx.Client),不发起真实网络;
真实调用 = 遗留 #1,由人写入 Key 后实测(gen_eval / demo)。
"""

import json

import pytest

from rag_service.deepseek_provider import (
    DEFAULT_MODEL,
    SYSTEM_PROMPT,
    DeepSeekProvider,
    _extract_json,
)
from rag_service.llm_adapter import RetrievedChunk


def chunk(i: int, doc_id: str = "doc-a") -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=f"{doc_id}-{i}", doc_id=doc_id, text=f"块 {i} 的正文内容。", score=0.9
    )


CHUNKS = [chunk(1), chunk(2)]
# 冲突用例:两个不同文档的块
CHUNKS_TWO_DOCS = [chunk(1, "doc-a"), chunk(2, "doc-b")]

MINIMAL_BODY = {
    "choices": [{"message": {"content": '{"answer": "x", "citations": [], "conflicts": null}'}}]
}


def stubbed(monkeypatch, body=None) -> DeepSeekProvider:
    """provider + _chat_completion 打桩:content 字符串或整响应体 dict。"""
    p = DeepSeekProvider(api_key="test-key")
    if body is None:
        body = MINIMAL_BODY
    monkeypatch.setattr(p, "_chat_completion", lambda payload: body)
    return p


# ── 配置与 Key ──

def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY 未配置"):
        DeepSeekProvider().generate("问题", CHUNKS)


def test_key_and_config_from_env(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "env-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v3")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://proxy.example.com/v1")
    monkeypatch.setenv("DEEPSEEK_TIMEOUT", "30")
    p = DeepSeekProvider()
    assert p.api_key == "env-key"
    assert p.model == "deepseek-v3"
    assert p.base_url == "https://proxy.example.com/v1"
    assert p.timeout == 30.0


def test_explicit_args_win_over_env(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_MODEL", "env-model")
    p = DeepSeekProvider(api_key="k", model="arg-model")
    assert p.model == "arg-model"


# ── prompt 组装 ──

def test_payload_numbered_context(monkeypatch):
    captured = {}
    p = DeepSeekProvider(api_key="k")

    def fake(payload):
        captured["payload"] = payload
        return MINIMAL_BODY

    monkeypatch.setattr(p, "_chat_completion", fake)
    p.generate("问题", CHUNKS)
    payload = captured["payload"]
    assert payload["model"] == DEFAULT_MODEL
    assert payload["temperature"] == 0.1
    assert payload["stream"] is False
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["messages"][0]["content"] == SYSTEM_PROMPT
    user = payload["messages"][1]["content"]
    assert "问题" in user
    assert "[1]" in user and "[2]" in user
    assert "块 1 的正文内容。" in user
    assert "(文档 doc-a / 块 doc-a-1)" in user


def test_empty_chunks_returns_empty_draft_without_http(monkeypatch):
    p = DeepSeekProvider(api_key="k")
    called = {"n": 0}
    monkeypatch.setattr(
        p, "_chat_completion", lambda payload: called.__setitem__("n", 1)
    )
    draft = p.generate("问题", [])
    assert draft.answer == "" and draft.citations == [] and draft.conflicts is None
    assert called["n"] == 0


# ── JSON 提取 ──

def test_extract_json_plain():
    assert _extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_nested_and_string_braces():
    obj = _extract_json('前缀 ```json\n{"a": {"b": [1, {"c": "}"}]}, "s": "}{"}\n``` 后缀')
    assert obj["a"]["b"][1]["c"] == "}"
    assert obj["s"] == "}{"


def test_extract_json_no_object():
    with pytest.raises(ValueError, match="无 JSON"):
        _extract_json("没有花括号")


def test_extract_json_unclosed():
    with pytest.raises(ValueError, match="不闭合"):
        _extract_json('{"a": ')


def test_extract_json_invalid_syntax():
    with pytest.raises(ValueError, match="解析失败"):
        _extract_json('{"a": }')


def test_extract_json_non_dict():
    """提取目标就是 JSON 对象:非对象(如数组)按「无 JSON 对象」报错。"""
    with pytest.raises(ValueError, match="无 JSON"):
        _extract_json('["list"]')


# ── 输出映射 ──

def test_plain_json_maps_refs(monkeypatch):
    content = json.dumps(
        {
            "answer": "答案",
            "citations": [
                {"ref": 2, "quote": "第二块摘句"},
                {"ref": 1, "quote": "第一块摘句"},
            ],
            "conflicts": None,
        },
        ensure_ascii=False,
    )
    draft = stubbed(monkeypatch, MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}).generate(
        "问题", CHUNKS
    )
    assert draft.answer == "答案"
    assert [(c.chunk_id, c.doc_id) for c in draft.citations] == [
        ("doc-a-2", "doc-a"),
        ("doc-a-1", "doc-a"),
    ]
    assert draft.citations[0].quote == "第二块摘句"
    assert draft.conflicts is None


def test_fenced_json_tolerated(monkeypatch):
    content = '好的,以下是答案:\n```json\n{"answer": "x", "citations": [], "conflicts": null}\n```\n以上。'
    body = MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}
    draft = stubbed(monkeypatch, body).generate("问题", CHUNKS)
    assert draft.answer == "x"


def test_invalid_refs_dropped(monkeypatch):
    content = json.dumps(
        {
            "answer": "x",
            "citations": [
                {"ref": 1},
                {"ref": 99, "quote": "q"},
                {"ref": "a"},
                {"ref": None},
                "garbage",
            ],
            "conflicts": None,
        }
    )
    body = MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}
    draft = stubbed(monkeypatch, body).generate("问题", CHUNKS)
    assert [c.chunk_id for c in draft.citations] == ["doc-a-1"]
    assert draft.citations[0].quote == ""


def test_conflicts_mapped_to_doc_pairs(monkeypatch):
    content = json.dumps(
        {
            "answer": "x",
            "citations": [],
            "conflicts": [
                {"ref_a": 1, "ref_b": 2, "quote_a": "甲", "quote_b": "乙"},
                {"ref_a": 1, "ref_b": 1, "quote_a": "甲", "quote_b": "甲"},  # 同块 → 丢弃
                {"ref_a": 1, "ref_b": 99, "quote_a": "甲", "quote_b": "乙"},  # 越界 → 丢弃
                "garbage",
            ],
        }
    )
    body = MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}
    draft = stubbed(monkeypatch, body).generate("问题", CHUNKS_TWO_DOCS)
    assert len(draft.conflicts) == 1
    conflict = draft.conflicts[0]
    assert (conflict.doc_a, conflict.doc_b) == ("doc-a", "doc-b")
    assert (conflict.quote_a, conflict.quote_b) == ("甲", "乙")


def test_conflicts_non_list_ignored(monkeypatch):
    for raw in ("garbage", None, 42):
        content = json.dumps({"answer": "x", "citations": [], "conflicts": raw})
        body = MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}
        draft = stubbed(monkeypatch, body).generate("问题", CHUNKS_TWO_DOCS)
        assert draft.conflicts is None


def test_answer_non_string_becomes_empty(monkeypatch):
    content = json.dumps({"answer": 123, "citations": [{"ref": 1}], "conflicts": None})
    body = MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}
    draft = stubbed(monkeypatch, body).generate("问题", CHUNKS)
    assert draft.answer == ""
    assert [c.chunk_id for c in draft.citations] == ["doc-a-1"]


def test_model_empty_answer_passes_through(monkeypatch):
    """模型空回答(上下文无答案)→ 空 draft,由管线层 schema 失败 → 拒答处理。"""
    content = json.dumps({"answer": "", "citations": [], "conflicts": None})
    body = MINIMAL_BODY | {"choices": [{"message": {"content": content}}]}
    draft = stubbed(monkeypatch, body).generate("问题", CHUNKS)
    assert draft.answer == "" and draft.citations == []


# ── HTTP 层 ──

def test_http_request_shape(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        text = ""

        def json(self):
            return MINIMAL_BODY

    class FakeClient:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, headers, json):
            captured["url"] = url
            captured["headers"] = headers
            captured["body"] = json
            return FakeResponse()

    monkeypatch.setattr("rag_service.deepseek_provider.httpx.Client", FakeClient)
    p = DeepSeekProvider(api_key="k", base_url="https://api.deepseek.com/")
    draft = p.generate("问题", CHUNKS)
    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer k"
    assert captured["timeout"] == 60.0
    assert captured["body"]["messages"][1]["content"].startswith("问题")
    assert draft.answer == "x"


def test_non_200_raises(monkeypatch):
    class FakeResponse:
        status_code = 401
        text = '{"error": "bad key"}'

    class FakeClient:
        def __init__(self, timeout):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr("rag_service.deepseek_provider.httpx.Client", FakeClient)
    with pytest.raises(RuntimeError, match="401"):
        DeepSeekProvider(api_key="k").generate("问题", CHUNKS)


def test_timeout_maps_to_runtime_error(monkeypatch):
    import httpx

    class FakeClient:
        def __init__(self, timeout):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, *args, **kwargs):
            raise httpx.TimeoutException("timed out")

    monkeypatch.setattr("rag_service.deepseek_provider.httpx.Client", FakeClient)
    with pytest.raises(RuntimeError, match="超时"):
        DeepSeekProvider(api_key="k").generate("问题", CHUNKS)


def test_response_structure_anomaly_raises(monkeypatch):
    p = DeepSeekProvider(api_key="k")
    monkeypatch.setattr(p, "_chat_completion", lambda payload: {"unexpected": True})
    with pytest.raises(RuntimeError, match="结构异常"):
        p.generate("问题", CHUNKS)


def test_content_non_string_raises(monkeypatch):
    p = DeepSeekProvider(api_key="k")
    monkeypatch.setattr(
        p, "_chat_completion", lambda payload: {"choices": [{"message": {"content": ["x"]}}]}
    )
    with pytest.raises(RuntimeError, match="非字符串"):
        p.generate("问题", CHUNKS)
