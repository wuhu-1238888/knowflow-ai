"use client";

import { useState } from "react";

import { AnswerSheet } from "@/components/ask/answer-sheet";
import { AskTextarea } from "@/components/ask/ask-textarea";
import { ConflictPanel } from "@/components/ask/conflict-panel";
import { ErrorCallout } from "@/components/ask/error-callout";
import { NoAnswerCallout } from "@/components/ask/no-answer-callout";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ApiError, askQuestion, type AskResponse } from "@/lib/rag";

/* 问答页(3.3.2 最小闭环切片):提问 → 带引用回答 / 拒答 / 冲突 / 失败,回答与依据同屏并置。
 * 2026-09-09 人拍板:检索策略不暴露给普通用户——页面固定使用默认策略
 * Hybrid + Rerank(client 默认,与后端 /api/ask 默认一致),三模式对比见评测页。
 * 示例问题来自评测集(C01/C13/C11)。
 * C13 在 Mock 下演示双口径并列回答(冲突面板 UI 已实现,后端 conflicts 恒 null → 遗留 #1)。
 * 切片未含:双向证据联动 / SourceDrawer / 重新生成 / 有用·无用(3.3.2 全量补齐);
 * 加载态合并为「AI 生成中」胶囊(检索中 Skeleton 待流式分段后细分)。
 * 垂直节奏(2026-09-09 人拍板):主内容顶部呼吸空间 24px(<1024px)/48px(≥1024px);
 * 页头 → 提问区与各区块间统一 24px(gap-6),加载态与结果态同位不跳动。 */

const EXAMPLE_QUESTIONS = [
  { query: "年假有几天?", hint: "回答 + 引用(评测集 C01)" },
  // Mock 下冲突面板不会出现(conflicts 恒 null,遗留 #1):此例演示双口径并列回答
  { query: "市内交通费每天报销上限是多少?", hint: "双口径并列回答(冲突面板需真实 LLM,遗留 #1)" },
  { query: "公司有宠物寄养福利吗?", hint: "知识库无答案 → 拒答(评测集 C11)" },
];

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await askQuestion(trimmed));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "请求失败,请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-6 lg:pt-12">
      <PageHeader title="知识问答" subtitle="企业知识助手,基于企业知识库回答问题" />

      <div className="flex flex-col gap-2">
        <AskTextarea
          value={query}
          onChange={setQuery}
          onSubmit={() => void submit(query)}
          disabled={loading}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption text-ink-3">
            Enter 提问 · Shift+Enter 换行 · / 聚焦输入框
          </p>
          <Button disabled={loading || !query.trim()} onClick={() => void submit(query)}>
            提问
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-start gap-2">
          {/* 「AI 生成中」胶囊:唯一 pill + 唯一 shimmer(白名单) */}
          <span className="inline-flex animate-shimmer items-center gap-1.5 rounded-full bg-ai-gradient px-3 py-1.5 text-body-sm text-ink-inverse">
            AI 生成中
          </span>
          <p className="text-body-sm text-ink-2">
            正在检索企业知识库并生成回答,首次回答约需 1 分钟…
          </p>
        </div>
      ) : null}

      {!loading && error ? (
        <ErrorCallout message={error} onRetry={() => void submit(query)} />
      ) : null}

      {!loading && !error && !result ? (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-ink-2">试试这些问题:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((example) => (
              <Button
                key={example.query}
                variant="secondary"
                title={example.hint}
                onClick={() => {
                  setQuery(example.query);
                  void submit(example.query);
                }}
              >
                {example.query}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !error && result && result.no_answer ? (
        <NoAnswerCallout />
      ) : null}

      {!loading && !error && result && !result.no_answer && result.answer !== null ? (
        <div className="flex flex-col gap-3">
          <AnswerSheet answer={result.answer} citations={result.citations} />
          {result.conflicts ? <ConflictPanel conflicts={result.conflicts} /> : null}
        </div>
      ) : null}
    </div>
  );
}
