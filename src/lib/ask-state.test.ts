import { afterEach, describe, expect, it } from "vitest";

import { loadAskSnapshot, saveAskSnapshot } from "@/lib/ask-state";
import type { AnswerVersion } from "@/components/ask/previous-answer";

/* L3 会话快照序列化测试(2026-09-13,文档详情返回上下文):
   保存 → 读取往返(Date 还原/拒答/历史/上一版);损坏数据与旧版本静默返回 null
   (宁可空态也不抛错)。 */

const LATEST: AnswerVersion = {
  qa_id: "qa-1",
  answer: "回答[1]。",
  citations: [],
  conflicts: null,
  version: 1,
  createdAt: new Date("2026-09-13T10:00:00Z"),
};

function snapshot() {
  return {
    query: "年假有几天?",
    lastQuery: "年假有几天?",
    latest: LATEST,
    previous: null,
    refusal: null,
    sameNotice: false,
    history: [
      {
        query: "年假有几天?",
        latest: LATEST,
        previous: null,
        refusal: null,
        sameNotice: false,
      },
    ],
  };
}

afterEach(() => {
  sessionStorage.clear();
});

describe("ask-state 快照", () => {
  it("保存后读取:字段完整,createdAt 还原为 Date 实例(历史条目同样还原)", () => {
    saveAskSnapshot(snapshot());
    const loaded = loadAskSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded!.query).toBe("年假有几天?");
    expect(loaded!.latest?.answer).toBe("回答[1]。");
    expect(loaded!.latest?.createdAt).toBeInstanceOf(Date);
    expect(loaded!.latest?.createdAt.toISOString()).toBe(
      "2026-09-13T10:00:00.000Z",
    );
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.history[0].latest?.createdAt).toBeInstanceOf(Date);
  });

  it("拒答快照:refusal 保留原样,latest 为 null", () => {
    saveAskSnapshot({
      ...snapshot(),
      latest: null,
      refusal: {
        qa_id: "qa-2",
        answer: null,
        citations: [],
        no_answer: true,
        refusal_reason: "no_evidence",
        relevant_hits: 0,
        confidence: 0.1,
        conflicts: null,
        mode: "hybrid_rerank",
        elapsed_ms: 1500,
      },
    });
    const loaded = loadAskSnapshot();
    expect(loaded!.latest).toBeNull();
    expect(loaded!.refusal?.no_answer).toBe(true);
    expect(loaded!.refusal?.refusal_reason).toBe("no_evidence");
  });

  it("无存档 / 损坏 JSON / 版本不符 → 静默返回 null", () => {
    expect(loadAskSnapshot()).toBeNull();
    sessionStorage.setItem("kf:ask:snapshot", "{ 不是 JSON");
    expect(loadAskSnapshot()).toBeNull();
    sessionStorage.setItem("kf:ask:snapshot", JSON.stringify({ v: 99, state: {} }));
    expect(loadAskSnapshot()).toBeNull();
  });

  it("存储不可用(抛出异常)时保存静默降级", () => {
    const original = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveAskSnapshot(snapshot())).not.toThrow();
    sessionStorage.setItem = original;
  });
});
