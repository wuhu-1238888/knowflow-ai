"""DeepSeekProvider:OpenAI 兼容 /chat/completions 真实调用(遗留 #1 代码部分)。

契约与 MockProvider 一致(LLMProvider):输入 query + 检索块,输出 AnswerDraft。
设计边界(与 answer_pipeline 分工):
- Key 只从 .env 读(DEEPSEEK_API_KEY,由 config.load_dotenv 加载),AI 绝不写 Key、
  绝不入库;未配置时抛 RuntimeError(提示人写 Key 或改用 mock);
- 引用编号 = prompt 中上下文块编号 [n],provider 映射「模型选了哪些块」并把正文
  [n] 标记同步重写为稠密编号、删除悬空标记(见 _renumber_markers);quote 与最终
  校验仍由管线层规则侧重建(见 answer_pipeline._map_citations),绝不信任模型自报来源;
- 冲突 = 模型标注的两个上下文块编号,映射为 doc_id 对;双方是否在本次检索结果内
  由管线层校验(_map_conflicts);
- 拒答不属于本模块:τ 阈值在管线层,模型空回答也由管线按 schema 失败 → 拒答处理;
- 超时/重试:单次调用超时 = DEEPSEEK_TIMEOUT(默认 60s,须留出检索时间与
  BFF 120s 预算);重试由管线层 GENERATE_RETRIES 承担,本模块异常直接上抛。
"""

import json
import os
import re

import httpx

from .llm_adapter import AnswerDraft, Citation, Conflict, RetrievedChunk

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_TIMEOUT = 60  # 秒:单次 API 调用上限(BFF ask 上限 120s,需留检索时间)

SYSTEM_PROMPT = """你是 KnowFlow AI 的企业知识问答助手,只依据「上下文」回答,不得使用外部知识。

输出严格 JSON(不要输出任何其他文字):
{
  "answer": "回答正文(简洁中文;摘用上下文内容时在句末标注编号 [n],n 为上下文块编号)",
  "citations": [{"ref": 1, "quote": "块 1 中被你摘用的原文短句(逐字)"}],
  "conflicts": null
}

规则:
1. 上下文没有答案时:answer 为空字符串 "" 且 citations 为空数组,不要编造。
2. citations 列出你摘用的所有上下文块:ref 必须是上下文块编号,quote 必须逐字摘自该块原文。
3. 若两个上下文块内容相互矛盾(如新旧版本制度):回答中并列说明两者、不选边,并在
   conflicts 中给出双方:{"ref_a": 1, "ref_b": 2, "quote_a": "块1原文摘句", "quote_b": "块2原文摘句"};
   没有矛盾时 conflicts 为 null。"""


def _extract_json(text: str) -> dict:
    """从模型输出提取首个平衡 JSON 对象(容忍 ```json 围栏与前后缀杂文)。"""
    start = text.find("{")
    if start == -1:
        raise ValueError(f"模型输出无 JSON 对象: {text[:120]!r}")
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                payload = text[start : i + 1]
                try:
                    obj = json.loads(payload)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"模型输出 JSON 解析失败: {exc};原文: {payload[:200]!r}"
                    ) from exc
                if not isinstance(obj, dict):
                    raise ValueError(f"模型输出 JSON 不是对象: {payload[:120]!r}")
                return obj
    raise ValueError(f"模型输出 JSON 不闭合: {text[start:start + 120]!r}")


def _renumber_markers(answer: str, ref_map: dict[int, int]) -> str:
    """正文 [n] 标记同步重写:模型按上下文块编号标注(如只摘用块 1、3 时写 [1]/[3]),
    而引用被稠密重编号为 1、2 → 正文 [3] 悬空。此处把标记重写为新编号,
    未出现在引用中的悬空标记直接删除;两段式替换(占位符中转)避免降序替换级联
    (如 {2:1, 3:2} 时先 [3]→[2] 再 [2]→[1] 会把新 [2] 误换掉)。"""
    def _to_placeholder(match: re.Match[str]) -> str:
        new = ref_map.get(int(match.group(1)))
        return f"\x00{new}\x00" if new is not None else ""

    out = re.sub(r"\[(\d+)\]", _to_placeholder, answer)
    out = re.sub(r"\x00(\d+)\x00", r"[\1]", out)
    # 悬空标记删除后的残留空白:折叠多空格、去标点前空格
    out = re.sub(r" {2,}", " ", out)
    out = re.sub(r" (?=[,。;:!?、])", "", out)
    return out


class DeepSeekProvider:
    """真实 LLM provider:Key 由人写入 .env;环境变量可覆盖模型/地址/超时。"""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        timeout: float | None = None,
    ):
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY", "")
        self.model = model or os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL)
        self.base_url = (
            base_url or os.environ.get("DEEPSEEK_BASE_URL", DEFAULT_BASE_URL)
        ).rstrip("/")
        self.timeout = timeout or float(
            os.environ.get("DEEPSEEK_TIMEOUT", DEFAULT_TIMEOUT)
        )

    def generate(self, query: str, chunks: list[RetrievedChunk]) -> AnswerDraft:
        if not self.api_key:
            raise RuntimeError(
                "DEEPSEEK_API_KEY 未配置:请由人写入 .env(遗留 #1);"
                "开发与评测请使用默认 LLM_PROVIDER=mock"
            )
        if not chunks:
            return AnswerDraft(answer="", citations=[], conflicts=None)
        body = self._chat_completion(self._build_payload(query, chunks))
        content = self._parse_content(body)
        return self._to_draft(_extract_json(content), chunks)

    # ── prompt 组装 ──

    def _build_payload(self, query: str, chunks: list[RetrievedChunk]) -> dict:
        lines = []
        for i, chunk in enumerate(chunks, start=1):
            lines.append(f"[{i}] (文档 {chunk.doc_id} / 块 {chunk.chunk_id})")
            lines.append(chunk.text)
        user_content = f"问题:{query}\n\n上下文:\n" + "\n\n".join(lines)
        return {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.1,
            "max_tokens": 2000,
            "stream": False,
            "response_format": {"type": "json_object"},  # OpenAI 兼容:强制 JSON 输出
        }

    # ── HTTP 调用(超时/网络/HTTP 错误统一转 RuntimeError,交给管线重试)──

    def _chat_completion(self, payload: dict) -> dict:
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise RuntimeError(f"DeepSeek 调用超时({self.timeout:g}s)") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"DeepSeek 网络错误: {type(exc).__name__}: {exc}") from exc
        if response.status_code != 200:
            raise RuntimeError(
                f"DeepSeek API 错误 {response.status_code}: {response.text[:200]}"
            )
        return response.json()

    @staticmethod
    def _parse_content(body: dict) -> str:
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(
                f"DeepSeek 响应结构异常: {json.dumps(body, ensure_ascii=False)[:200]}"
            ) from exc
        if not isinstance(content, str):
            raise RuntimeError(f"DeepSeek 响应 content 非字符串: {content!r}"[:200])
        return content

    # ── 输出映射:模型 JSON → AnswerDraft ──

    def _to_draft(
        self, obj: dict, chunks: list[RetrievedChunk]
    ) -> AnswerDraft:
        by_ref = {i + 1: chunk for i, chunk in enumerate(chunks)}
        citations: list[Citation] = []
        ref_map: dict[int, int] = {}  # 模型上下文块编号 → 稠密引用编号(正文标记同步用)
        for raw in obj.get("citations") or []:
            if not isinstance(raw, dict):
                continue
            ref = raw.get("ref")
            chunk = by_ref.get(ref)
            if chunk is None:  # 编号越界/非法 → 丢弃(管线层还会再校验检索集)
                continue
            if ref in ref_map:  # 同一块重复摘句:仅取首个(管线层按 chunk 去重,quote 规则侧重建;
                continue        # 若不丢弃,ref_map 被反复覆盖会把正文标记重写成不存在的编号)
            quote = raw.get("quote")
            citations.append(
                Citation(
                    index=len(citations) + 1,
                    doc_id=chunk.doc_id,
                    chunk_id=chunk.chunk_id,
                    quote=quote if isinstance(quote, str) else "",
                )
            )
            if isinstance(ref, int):
                ref_map[ref] = len(citations)
        conflicts: list[Conflict] | None = None
        conflicts_raw = obj.get("conflicts")
        if isinstance(conflicts_raw, list):
            conflicts = []
            for raw in conflicts_raw:
                if not isinstance(raw, dict):
                    continue
                chunk_a = by_ref.get(raw.get("ref_a"))
                chunk_b = by_ref.get(raw.get("ref_b"))
                if chunk_a is None or chunk_b is None or chunk_a.doc_id == chunk_b.doc_id:
                    continue
                conflicts.append(
                    Conflict(
                        doc_a=chunk_a.doc_id,
                        doc_b=chunk_b.doc_id,
                        quote_a=str(raw.get("quote_a", "")),
                        quote_b=str(raw.get("quote_b", "")),
                    )
                )
        answer = obj.get("answer", "")
        answer = answer if isinstance(answer, str) else ""
        if answer:
            answer = _renumber_markers(answer, ref_map)
        return AnswerDraft(
            answer=answer,
            citations=citations,
            conflicts=conflicts,
        )
