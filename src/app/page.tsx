"use client";

import { useEffect, useRef, useState } from "react";

import { AnswerSheet } from "@/components/ask/answer-sheet";
import { AnswerSkeleton } from "@/components/ask/answer-skeleton";
import { AskTextarea } from "@/components/ask/ask-textarea";
import { ErrorCallout } from "@/components/ask/error-callout";
import { NoAnswerCallout } from "@/components/ask/no-answer-callout";
import { PreviousAnswer, type AnswerVersion } from "@/components/ask/previous-answer";
import { RecentQuestions, type HistoryEntry } from "@/components/ask/recent-questions";
import { QuestionChip } from "@/components/ask/question-chip";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { loadAskSnapshot, saveAskSnapshot } from "@/lib/ask-state";
import { versionAgeLabel } from "@/lib/format";
import { setNavSource } from "@/lib/nav-context";
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

/* 会话历史上限(2026-09-13 闭环优化,规格 9):仅当前会话,最近的在最前。 */
const HISTORY_LIMIT = 6;

/* 等待文案两档(2026-09-14):20 秒内统一话术;之后切换「仍在处理中」+
   真实已等待秒数(真实计时,不伪造阶段/百分比)。 */
const LONG_WAIT_SECONDS = 20;

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "asking" | "regenerating">("idle");
  const [latest, setLatest] = useState<AnswerVersion | null>(null);
  const [previous, setPrevious] = useState<AnswerVersion | null>(null);
  const [refusal, setRefusal] = useState<AskResponse | null>(null);
  const [sameNotice, setSameNotice] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  /* 等待时长(真实秒数,仅用于长等待话术);请求开始时重置。 */
  const [elapsed, setElapsed] = useState(0);
  /* 本会话首问(提交时无历史)→ 长等待时追加冷启动提示;绝不常显。 */
  const coldStartRef = useRef(false);
  /* 回答/拒答卡进场动画(2026-09-14 人规格):仅「等待态 Skeleton → 结果」
     切换时一次性 240ms;历史回看/快照恢复/重新生成不触发。 */
  const [answerEntrance, setAnswerEntrance] = useState(false);

  /* 返回上下文(2026-09-13):挂载时标记来源(供文档详情页返回判断)并恢复
     本标签页的会话快照(从「查看原文」返回时问答上下文不丢)。 */
  useEffect(() => {
    setNavSource("qa");
    const snapshot = loadAskSnapshot();
    if (snapshot) {
      setQuery(snapshot.query);
      setLastQuery(snapshot.lastQuery);
      setLatest(snapshot.latest);
      setPrevious(snapshot.previous);
      setRefusal(snapshot.refusal);
      setSameNotice(snapshot.sameNotice);
      setHistory(snapshot.history);
    }
  }, []);

  /* 快照持久化:跳过挂载当帧(此时恢复 effect 尚未落位,空态会覆盖已存快照)。 */
  const skipSaveRef = useRef(true);
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveAskSnapshot({
      query,
      lastQuery,
      latest,
      previous,
      refusal,
      sameNotice,
      history,
    });
  }, [query, lastQuery, latest, previous, refusal, sameNotice, history]);

  /* 等待计时:请求中每秒 +1(真实已等待秒数);回到 idle 清零。 */
  useEffect(() => {
    if (phase === "idle") {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  /* 会话历史 upsert:同问题覆盖为最新快照,最近的在最前,上限 6 条 */
  const pushHistory = (entry: HistoryEntry) => {
    setHistory((prev) =>
      [entry, ...prev.filter((item) => item.query !== entry.query)].slice(
        0,
        HISTORY_LIMIT,
      ),
    );
  };

  /* 回看历史:纯状态恢复(不发新请求),结果区还原当时的回答/拒答/上一版 */
  const showHistory = (entry: HistoryEntry) => {
    setQuery(entry.query);
    setLastQuery(entry.query);
    setLatest(entry.latest);
    setPrevious(entry.previous);
    setRefusal(entry.refusal);
    setSameNotice(entry.sameNotice);
    setError(null);
    /* 回看是纯状态恢复,不播进场动画(规格:动画仅属于等待态 → 结果切换) */
    setAnswerEntrance(false);
  };

  async function submit(question: string, regenerate = false) {
    const trimmed = question.trim();
    if (!trimmed || phase !== "idle") {
      return;
    }
    /* 版本语义:重新生成只对比被重生成的版本;新问题整体重置结果区。
       (setState 异步,闭包中的 latest 仍是点击时的值——用局部变量钉住。) */
    const regeneratedVersion = regenerate ? latest : null;
    /* 本会话首问(尚无历史)= 可能触发后端冷启动(模型加载),仅供长等待话术使用 */
    coldStartRef.current = !regenerate && history.length === 0;
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
        /* 等待态 → 结果切换才播进场动画;重新生成(旧卡可见,无 Skeleton)不播 */
        setAnswerEntrance(!regenerate);
        pushHistory({
          query: trimmed,
          latest: null,
          previous: regeneratedVersion,
          refusal: result,
          sameNotice: false,
        });
        return;
      }
      if (regeneratedVersion && regeneratedVersion.answer === result.answer) {
        // 真实重新生成但内容一致:明确告知,不复制旧卡片伪装新结果
        setSameNotice(true);
        pushHistory({
          query: trimmed,
          latest,
          previous,
          refusal,
          sameNotice: true,
        });
        return;
      }
      const nextVersion: AnswerVersion = {
        qa_id: result.qa_id,
        answer: result.answer as string,
        citations: result.citations,
        conflicts: result.conflicts,
        version: (regeneratedVersion ? regeneratedVersion.version : 0) + 1,
        createdAt: new Date(),
      };
      setPrevious(regeneratedVersion);
      setLatest(nextVersion);
      setRefusal(null);
      setAnswerEntrance(!regenerate);
      pushHistory({
        query: trimmed,
        latest: nextVersion,
        previous: regeneratedVersion,
        refusal: null,
        sameNotice: false,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "回答生成失败,请稍后重试。");
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
          <Button
            disabled={busy || !query.trim()}
            loading={busy}
            onClick={() => void submit(query)}
          >
            {busy ? "生成中…" : "提问"}
          </Button>
        </div>
      </div>

      {phase === "asking" ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {/* 「AI 生成中」胶囊:唯一 pill + 唯一 shimmer(白名单),仅首次提问使用;
              重新生成的加载态在最新回答卡内。后端无阶段状态 → 统一话术,
              不伪造「检索→重排→生成」多阶段;20 秒后切「仍在处理中」+
              真实已等待秒数(2026-09-14,绝不常显「约需 1 分钟」)。
              2026-09-14 人拍板回调:胶囊 + 话术 + 冷启动提示位于骨架卡上方,
              与卡片左边缘对齐、左对齐排版(卡外、不居中)。 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex animate-shimmer items-center gap-1.5 rounded-full bg-ai-gradient px-2.5 py-[3px] text-caption text-ink-inverse">
              AI 生成中
            </span>
            <p className="text-body-sm text-ink-2">
              {elapsed >= LONG_WAIT_SECONDS
                ? `仍在处理中,请稍候…已等待 ${elapsed} 秒`
                : "正在检索企业知识库并生成回答…"}
            </p>
          </div>
          {coldStartRef.current && elapsed >= LONG_WAIT_SECONDS ? (
            <p className="-mt-1.5 text-caption text-ink-3">
              首次回答可能需要更长时间,请稍候…
            </p>
          ) : null}
          <AnswerSkeleton />
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
              <QuestionChip
                key={example.query}
                label={example.query}
                hint={example.hint}
                onClick={() => {
                  setQuery(example.query);
                  void submit(example.query);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {refusal ? (
        <div className={`flex flex-col gap-3${answerEntrance ? " animate-answer-in" : ""}`}>
          <NoAnswerCallout
            reason={refusal.refusal_reason ?? "no_evidence"}
            relevantHits={refusal.relevant_hits ?? 0}
          />
          {previous ? <PreviousAnswer version={previous} /> : null}
        </div>
      ) : latest ? (
        <div className="flex flex-col gap-3">
          {/* key = qa_id:每个版本独立组件状态(冲突展开/反馈/抽屉互不串) */}
          <AnswerSheet
            key={latest.qa_id}
            variant="latest"
            answer={latest.answer}
            citations={latest.citations}
            conflicts={latest.conflicts}
            qaId={latest.qa_id}
            versionMeta={`v${latest.version} · ${versionAgeLabel(latest.createdAt)}`}
            generating={phase === "regenerating"}
            animateIn={answerEntrance}
            sameNotice={sameNotice}
            onRegenerate={() => void submit(lastQuery, true)}
          />
          {previous ? <PreviousAnswer version={previous} /> : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="border-t border-hairline pt-4">
          <RecentQuestions
            items={history}
            activeQuery={lastQuery}
            onSelect={showHistory}
          />
        </div>
      ) : null}
    </div>
  );
}
