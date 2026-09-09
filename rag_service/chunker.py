"""分块策略(规则化,参数为常量——改动须人拍板+重跑评测):

1. 按空行切块(block),以「标题行」(# 开头)作为新 chunk 的天然起点;
2. 块按序累积进当前 chunk,上限 CHUNK_MAX_CHARS(约 1000 字符);
3. 超长块强制滑动窗口切分,重叠 CHUNK_OVERLAP_CHARS(约 100 字符);
4. chunk_order 保证原文顺序(0 起连续编号)。

输入为 parsing.py 输出的纯文本(标题 # 前缀与列表/表格管道均保留)。
"""

import re
from dataclasses import dataclass

CHUNK_MAX_CHARS = 1000
CHUNK_OVERLAP_CHARS = 100

_HEADING_RE = re.compile(r"^#{1,6}\s")


@dataclass(frozen=True)
class TextChunk:
    text: str
    order: int


def _split_long_block(text: str) -> list[str]:
    """超长块强制滑动窗口切分:窗口 1000,步进 900(重叠 100)。"""
    pieces: list[str] = []
    pos = 0
    step = CHUNK_MAX_CHARS - CHUNK_OVERLAP_CHARS
    while pos < len(text):
        end = min(pos + CHUNK_MAX_CHARS, len(text))
        pieces.append(text[pos:end])
        if end == len(text):
            break
        pos += step
    return pieces


def chunk_text(text: str) -> list[TextChunk]:
    """文本 → 有序 chunk 列表;空文本返回空列表。"""
    if not text.strip():
        return []
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text.strip())]
    blocks = [b for b in blocks if b]

    raw: list[str] = []
    current: list[str] = []
    current_len = 0

    def flush() -> None:
        nonlocal current_len
        if current:
            raw.append("\n".join(current))
            current.clear()
        current_len = 0

    for block in blocks:
        is_heading = bool(_HEADING_RE.match(block))
        block_len = len(block) + 1  # +1 预留块间换行
        if is_heading and current:
            flush()  # 标题行开启新 chunk
        if block_len > CHUNK_MAX_CHARS:
            flush()
            raw.extend(_split_long_block(block))
            continue
        if current_len + block_len > CHUNK_MAX_CHARS and current:
            flush()
        current.append(block)
        current_len += block_len

    flush()
    return [TextChunk(text=t, order=i) for i, t in enumerate(raw)]
