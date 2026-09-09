"""DeepSeekProvider 骨架:与 MockProvider 同接口(LLMProvider)。

真实调用待遗留 #1(真实 LLM Key 未验证)解除后实现:
- OpenAI 兼容 /chat/completions 调用 + prompt 组装(上下文 + 引用编号指令);
- 输出 schema 校验(引用编号必须落在合法 chunk 范围,映射失败即该引用灰态);
- Key 只从 .env 读(DEEPSEEK_API_KEY),AI 绝不写 Key、绝不入库。
"""

import os

from .llm_adapter import AnswerDraft, RetrievedChunk


class DeepSeekProvider:
    def __init__(self, api_key: str | None = None, model: str = "deepseek-chat"):
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY", "")
        self.model = model

    def generate(self, query: str, chunks: list[RetrievedChunk]) -> AnswerDraft:
        if not self.api_key:
            raise RuntimeError(
                "DEEPSEEK_API_KEY 未配置:请由人写入 .env(遗留 #1);"
                "开发与评测请使用默认 LLM_PROVIDER=mock"
            )
        # TODO(遗留 #1):真实 Key 到位后实现调用 + prompt + schema 校验 + 重试策略
        raise NotImplementedError(
            "DeepSeek 真实调用待遗留 #1(真实 LLM Key)解除后实现"
        )
