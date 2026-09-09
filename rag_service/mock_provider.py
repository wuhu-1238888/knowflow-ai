"""MockProvider:确定性规则生成,零 Key、零网络、零随机。

生成规则(全部确定性,同输入必同输出——L5 断言基础):
1. 取前 MAX_SOURCE_CHUNKS(3)个检索块,每块摘首个完整句(中文句末标点或首行,≤120 字符);
2. answer = 摘句按序以空行拼接;
3. citations 按 chunk 输入顺序编号 1..n,quote = 摘句(保证是 chunk 原文子串,
   前端引用句高亮可精确匹配);
4. conflicts 恒为 None(冲突标注属于真实 LLM 能力,Mock 不伪造)。

职责边界:不做拒答判定(τ 阈值规则在 3.2.6 管线);空输入返回空 draft,
由管线层决定拒答话术。
"""

from .llm_adapter import AnswerDraft, Citation, RetrievedChunk

MAX_SOURCE_CHUNKS = 3
MAX_QUOTE_CHARS = 120

_SENTENCE_ENDINGS = "。!?！？"


def extract_sentence(text: str) -> str:
    """摘取文本首个完整句;无句末标点则取首个非空行;上限 120 字符。"""
    first_end = min(
        (idx for idx in (text.find(ch) for ch in _SENTENCE_ENDINGS) if idx != -1),
        default=-1,
    )
    if first_end != -1:
        return text[: first_end + 1][:MAX_QUOTE_CHARS]
    line = next((ln for ln in text.splitlines() if ln.strip()), "")
    return line.strip()[:MAX_QUOTE_CHARS]


class MockProvider:
    """默认 Provider:规则摘句 + 编号引用,确定性输出。"""

    def generate(self, query: str, chunks: list[RetrievedChunk]) -> AnswerDraft:
        citations: list[Citation] = []
        sentences: list[str] = []
        next_index = 1  # 引用编号 = 回答中出现序号(被摘用顺序),跳过无内容的块不占号
        for chunk in chunks[:MAX_SOURCE_CHUNKS]:
            sentence = extract_sentence(chunk.text)
            if not sentence:
                continue
            sentences.append(sentence)
            citations.append(
                Citation(
                    index=next_index,
                    doc_id=chunk.doc_id,
                    chunk_id=chunk.chunk_id,
                    quote=sentence,
                )
            )
            next_index += 1
        return AnswerDraft(
            answer="\n\n".join(sentences),
            citations=citations,
            conflicts=None,
        )
