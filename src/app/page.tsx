"use client";

import { useState } from "react";

import { AnswerSheet } from "@/components/ask/answer-sheet";
import { AskTextarea } from "@/components/ask/ask-textarea";
import { ConflictPanel } from "@/components/ask/conflict-panel";
import { ErrorCallout } from "@/components/ask/error-callout";
import { NoAnswerCallout } from "@/components/ask/no-answer-callout";
import { PreviousAnswer, type AnswerVersion } from "@/components/ask/previous-answer";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { versionAgeLabel } from "@/lib/format";
import { ApiError, askQuestion, type AskResponse } from "@/lib/rag";

/* 问答页(3.3.2 全量):提问 → 带引用回答 / 拒答 / 冲突 / 失败,回答与依据同屏并置。
 * 2026-09-09 人拍板:检索策略不暴露给普通用户——页面固定使用默认策略
 * Hybrid + Rerank(client 默认,与后端 /api/ask 默认一致),三模式对比见评测页。
 * 示例问题来自评测集(C01/C13/C11)。
 * 版本管理(3.4.4):「最新回答主卡 + 上一版折叠」模型——每次重新生成都是真实
 * /api/ask(新 qa_id),成功后新版本成为最新主卡,原最新自动降级为「上一版回答」
 * (默认折叠,展开后仅复制操作);新旧内容完全一致时不复制卡片、明确提示
 * 「已完成重新生成,本次回答与上一版一致」;拒答同样按版本处理(最新结果 =
 * 拒答卡,原回答降级);引用/冲突随各自版本存储,不串版本。
 * 垂直节奏(2026-09-09 人拍板):主内容顶部呼吸空间 24px(<1024px)/48px(≥1024px);
 * 页头 → 提问区与各区块间统一 24px(gap-6)。 */

const EXAMPLE_QUESTIONS = [
  { query: "年假有几天?", hint: "回答 + 引用(评测集 C01)" },
  { query: "市内交通费每天报销上限是多少?", hint: "回答 + 口径不一致双卡(评测集 C13)" },
  { query: "公司有宠物寄养福利吗?", hint: "知识库无答案 → 拒答(评测集 C11)" },
];

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "asking" | "regenerating">("idle");
  const [latest, setLatest] = useState<AnswerVersion | null>(null);
  const [previous, setPrevious] = useState<AnswerVersion | null>(null);
  const [refusal, setRefusal] = useState<AskResponse | null>(null);
  const [sameNotice, setSameNotice] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(question: string, regenerate = false) {
    const trimmed = question.trim();
    if (!trimmed || phase !== "idle") {
      return;
    }
    /* 版本语义:重新生成只对比被重生成的版本;新问题整体重置结果区。
       (setState 异步,闭包中的 latest 仍是点击时的值——用局部变量钉住。) */
    const regeneratedVersion = regenerate ? latest : null;
    setPhase(regenerate ? "regenerating" : "asking");
    setError(null);
    setSameNotice(false);
    setLastQuery(trimmed);
    if (!regenerate) {
      setLatest(null);
      setPrevious(null);
      setRefusal(null);
    }
    try {
      const result = await askQuestion(trimmed);
      if (result.no_answer) {
        // 拒答 = 当前最新结果(无内容卡);原最新回答降级为上一版
        setRefusal(result);
        setPrevious(regeneratedVersion);
        setLatest(null);
        return;
      }
      if (regeneratedVersion && regeneratedVersion.answer === result.answer) {
        // 真实重新生成但内容一致:明确告知,不复制旧卡片伪装新结果
        setSameNotice(true);
        return;
      }
      setPrevious(regeneratedVersion);
      setLatest({
        qa_id: result.qa_id,
        answer: result.answer as string,
        citations: result.citations,
        conflicts: result.conflicts,
        version: (regeneratedVersion ? regeneratedVersion.version : 0) + 1,
        createdAt: new Date(),
      });
      setRefusal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "请求失败,请稍后重试");
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";
  const hasResult = latest !== null || previous !== null || refusal !== null;

  return (
    <div className="flex flex-col gap-6 pt-6 lg:pt-12">
      <PageHeader title="知识问答" subtitle="企业知识助手,基于企业知识库回答问题" />

      <div className="flex flex-col gap-2">
        <AskTextarea
          value={query}
          onChange={setQuery}
          onSubmit={() => void submit(query)}
          disabled={busy}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption text-ink-3">
            Enter 提问 · Shift+Enter 换行 · / 聚焦输入框
          </p>
          <Button disabled={busy || !query.trim()} onClick={() => void submit(query)}>
            提问
          </Button>
        </div>
      </div>

      {phase === "asking" ? (
        <div className="flex flex-col items-start gap-2">
          {/* 「AI 生成中」胶囊:唯一 pill + 唯一 shimmer(白名单),仅首次提问使用;
              重新生成的加载态在最新回答卡内(不伪造多阶段) */}
          <span className="inline-flex animate-shimmer items-center gap-1.5 rounded-full bg-ai-gradient px-3 py-1.5 text-body-sm text-ink-inverse">
            AI 生成中
          </span>
          <p className="text-body-sm text-ink-2">
            正在检索企业知识库并生成回答,首次回答约需 1 分钟…
          </p>
        </div>
      ) : null}

      {phase === "idle" && error ? (
        <ErrorCallout message={error} onRetry={() => void submit(lastQuery, hasResult)} />
      ) : null}

      {phase === "idle" && !error && !hasResult ? (
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

      {refusal ? (
        <div className="flex flex-col gap-3">
          <NoAnswerCallout />
          {previous ? <PreviousAnswer version={previous} /> : null}
        </div>
      ) : latest ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <AnswerSheet
              variant="latest"
              answer={latest.answer}
              citations={latest.citations}
              qaId={latest.qa_id}
              versionMeta={`v${latest.version} · ${versionAgeLabel(latest.createdAt)}`}
              generating={phase === "regenerating"}
              sameNotice={sameNotice}
              onRegenerate={() => void submit(lastQuery, true)}
            />
            {/* 冲突信息属于当前版本:重新生成期间隐藏旧版本冲突,避免串版本 */}
            {phase !== "regenerating" && latest.conflicts ? (
              <ConflictPanel conflicts={latest.conflicts} />
            ) : null}
          </div>
          {previous ? <PreviousAnswer version={previous} /> : null}
        </div>
      ) : null}
    </div>
  );
}
