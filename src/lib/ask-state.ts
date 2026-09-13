import type { AnswerVersion } from "@/components/ask/previous-answer";
import type { HistoryEntry } from "@/components/ask/recent-questions";
import type { AskResponse } from "@/lib/rag";

/* 问答页会话快照(2026-09-13,文档详情返回上下文):
   知识问答页状态持久化到 sessionStorage(按标签页隔离)——从「查看原文」
   进入文档详情再返回时,问答页重挂载后恢复问题/回答/依据/上一版/拒答/
   一致提示/「最近问过」,用户无需重新提问。仅当前标签页,不落盘、不跨会话;
   反馈选中态由 AnswerSheet 挂载时 GET /api/qa/:id/feedback 恢复(3.4.6)。
   序列化:版本化 envelope { v, state },Date → ISO 字符串,恢复时还原,
   任何解析失败静默返回 null(宁可空态也不抛错)。 */

const KEY = "kf:ask:snapshot";
const VERSION = 1;

export interface AskPageSnapshot {
  query: string;
  lastQuery: string;
  latest: AnswerVersion | null;
  previous: AnswerVersion | null;
  refusal: AskResponse | null;
  sameNotice: boolean;
  history: HistoryEntry[];
}

function reviveVersion(version: AnswerVersion | null | undefined): AnswerVersion | null {
  if (!version) {
    return null;
  }
  return { ...version, createdAt: new Date(version.createdAt) };
}

function reviveEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    latest: reviveVersion(entry.latest),
    previous: reviveVersion(entry.previous),
  };
}

export function saveAskSnapshot(snapshot: AskPageSnapshot): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: VERSION, state: snapshot }));
  } catch {
    /* 存储不可用/超限时静默:返回上下文降级为空态 */
  }
}

export function loadAskSnapshot(): AskPageSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { v?: unknown; state?: AskPageSnapshot };
    if (parsed.v !== VERSION || !parsed.state) {
      return null;
    }
    const state = parsed.state;
    return {
      query: typeof state.query === "string" ? state.query : "",
      lastQuery: typeof state.lastQuery === "string" ? state.lastQuery : "",
      latest: reviveVersion(state.latest),
      previous: reviveVersion(state.previous),
      refusal: state.refusal ?? null,
      sameNotice: Boolean(state.sameNotice),
      history: Array.isArray(state.history)
        ? state.history.map(reviveEntry)
        : [],
    };
  } catch {
    return null;
  }
}
