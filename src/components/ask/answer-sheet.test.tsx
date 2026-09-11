import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Citation, ConflictItem } from "@/lib/rag";
import { AnswerSheet, formatAnswer, parseAnswerSegments } from "./answer-sheet";

/* L3 组件测试(3.3.2 全量):formatAnswer 清洗 / 引用段解析 / chip 渲染与灰态 /
   双向联动 / 来源抽屉 / 操作行(重新生成·复制·有用·无用)。
   3.4.6 操作反馈:互斥选中 / 防重复提交 / 失败恢复+提示 / 挂载恢复持久化 /
   复制反馈(真实 Clipboard 结果),fake timers 推进反馈自动恢复。 */

const CITATION: Citation = {
  index: 1,
  doc_id: "doc-1",
  chunk_id: "doc-1#0",
  quote: "入职第一年年假为 8 天,第二年起每年增加 1 天。",
  text: "入职第一年年假为 8 天,第二年起每年增加 1 天,上限 15 天。",
  source: "hybrid",
  score: 0.83,
  doc_title: "员工手册",
  doc_format: "md",
  doc_status: "indexed",
  doc_uploaded_at: "2026-09-01T00:00:00",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // 清理复制测试定义的 clipboard stub(jsdom 无原生实现)
  delete (navigator as unknown as { clipboard?: unknown }).clipboard;
});

describe("formatAnswer", () => {
  it("去除加粗、行内代码与标题井号,保留换行", () => {
    expect(formatAnswer("**重点** 与 `代码` 并存")).toBe("重点 与 代码 并存");
    expect(formatAnswer("## 标题\n正文第一行\n正文第二行")).toBe("标题\n正文第一行\n正文第二行");
  });

  it("无 markdown 符号时原样返回", () => {
    expect(formatAnswer("普通回答,无符号。")).toBe("普通回答,无符号。");
  });
});

describe("parseAnswerSegments", () => {
  it("按 [n] 标记交错拆分为文本段与引用段", () => {
    expect(parseAnswerSegments("年假 [1] 天,上限 [2] 天。")).toEqual([
      { text: "年假 ", index: null },
      { text: "[1]", index: 1 },
      { text: " 天,上限 ", index: null },
      { text: "[2]", index: 2 },
      { text: " 天。", index: null },
    ]);
  });

  it("无引用标记时整体为一段文本", () => {
    expect(parseAnswerSegments("普通回答。")).toEqual([
      { text: "普通回答。", index: null },
    ]);
  });
});

describe("AnswerSheet 结构与 chip", () => {
  it("渲染 AI 眉题、元信息行、依据带与操作行,元信息不含工程调试值", () => {
    render(<AnswerSheet answer="答案正文" citations={[CITATION]} />);
    expect(screen.getByText("AI 回答")).toBeTruthy();
    expect(screen.getByText("已基于企业知识库检索")).toBeTruthy();
    expect(screen.getByText("依据与来源(1)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "有用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "无用" })).toBeTruthy();
    // 2026-09-09 人拍板:模式徽标/最高分/耗时不出现在主流程元信息行
    expect(screen.queryByText(/最高分/)).toBeNull();
    expect(screen.queryByText(/耗时/)).toBeNull();
  });

  it("无依据时不渲染依据带", () => {
    render(<AnswerSheet answer="答案正文" citations={[]} />);
    expect(screen.queryByText(/依据与来源/)).toBeNull();
  });

  it("正文 [n] 标记渲染为可点引用 chip;超出依据带的编号显示灰态不可点", () => {
    render(
      <AnswerSheet answer="年假 [1] 天,报销 [9] 元。" citations={[CITATION]} />,
    );
    const chip = screen.getByRole("button", { name: "查看来源 [1]" });
    expect(chip.textContent).toBe("[1]");
    const missing = screen.getByTitle("引用来源缺失,无法核对原文");
    expect(missing.textContent).toBe("[9]");
    expect(missing.tagName).toBe("SPAN"); // 灰态不可点
  });
});

describe("EvidenceItem 结构与双向联动", () => {
  it("依据条目:标题/上传时间/引用片段/来源徽标/查看原文;不显示相关度(二轮收蓝)", () => {
    render(<AnswerSheet answer="答案正文" citations={[CITATION]} />);
    expect(screen.getByText("员工手册")).toBeTruthy();
    expect(screen.getByText("md · 上传于 2026-09-01")).toBeTruthy();
    expect(
      screen.getByText("入职第一年年假为 8 天,第二年起每年增加 1 天。"),
    ).toBeTruthy();
    expect(screen.getByText("混合")).toBeTruthy();
    // 相关度 = 工程调试信息,不进普通用户视图(保留在 API 与评测页)
    expect(screen.queryByText(/相关度/)).toBeNull();
    // 编号 chip = 中性灰(层级低于正文蓝色引用 chip)
    expect(screen.getByText("[1]").className).toContain("bg-surface-2");
    expect(screen.getByRole("button", { name: "查看原文" })).toBeTruthy();
  });

  it("悬停引用 chip → 回答引用句 brand-50 高亮 + 依据条目 brand-600 描边", () => {
    const { container } = render(
      <AnswerSheet answer="年假 [1] 天。" citations={[CITATION]} />,
    );
    const chip = screen.getByRole("button", { name: "查看来源 [1]" });
    fireEvent.mouseEnter(chip);
    const item = screen.getByRole("listitem");
    expect(item.className).toContain("border-brand-600");
    // 查询收敛到回答正文段内(「最新」标同用 brand-50,不在 p 内)
    const highlighted = container.querySelector("p .bg-brand-50");
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toContain("年假");
  });

  it("悬停依据条目 → 回答引用句高亮;移开后清除", () => {
    const { container } = render(
      <AnswerSheet answer="年假 [1] 天。" citations={[CITATION]} />,
    );
    fireEvent.mouseEnter(screen.getByRole("listitem"));
    expect(container.querySelector("p .bg-brand-50")).toBeTruthy();
    fireEvent.mouseLeave(screen.getByRole("listitem"));
    expect(container.querySelector("p .bg-brand-50")).toBeNull();
  });

  it("超长引用片段默认 4 行收起,可展开/收起", () => {
    const long: Citation = {
      ...CITATION,
      quote: "很长的一段引用。".repeat(40),
    };
    render(<AnswerSheet answer="答案正文" citations={[long]} />);
    const blockquote = screen.getByText((_, el) => el?.tagName === "BLOCKQUOTE");
    expect(blockquote?.className).toContain("line-clamp-4");
    fireEvent.click(screen.getByRole("button", { name: "展开全文" }));
    expect(screen.getByRole("button", { name: "收起" })).toBeTruthy();
    expect(
      screen.getByText((_, el) => el?.tagName === "BLOCKQUOTE")?.className,
    ).not.toContain("line-clamp-4");
  });
});

describe("来源抽屉", () => {
  it("点「查看原文」滑出抽屉:标题/元信息/完整原文/文档库链接,Esc 关闭(无分数)", () => {
    render(<AnswerSheet answer="答案正文" citations={[CITATION]} />);
    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    const dialog = screen.getByRole("dialog", {
      name: "来源 [1]:员工手册",
    });
    expect(within(dialog).getByText("员工手册")).toBeTruthy();
    expect(within(dialog).getByText("md")).toBeTruthy();
    expect(within(dialog).getByText("已索引")).toBeTruthy();
    expect(within(dialog).getByText("上传于 2026-09-01")).toBeTruthy();
    // 完整 chunk 原文(与引用片段不同,验证 text 富字段落位)
    expect(
      within(dialog).getByText(
        "入职第一年年假为 8 天,第二年起每年增加 1 天,上限 15 天。",
      ),
    ).toBeTruthy();
    // 二轮收蓝:相关度不进普通用户视图
    expect(within(dialog).queryByText(/相关度/)).toBeNull();
    expect(within(dialog).getByText("在文档库中查看")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("点引用 chip 同样滑出对应来源抽屉", () => {
    render(
      <AnswerSheet answer="年假 [1] 天。" citations={[CITATION]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "查看来源 [1]" }));
    expect(
      screen.getByRole("dialog", { name: "来源 [1]:员工手册" }),
    ).toBeTruthy();
  });
});

describe("操作行:重新生成 / 有用·无用", () => {
  it("重新生成触发 onRegenerate 回调(FR-11:页面层堆叠旧回答)", () => {
    const onRegenerate = vi.fn();
    render(
      <AnswerSheet answer="答案" citations={[CITATION]} onRegenerate={onRegenerate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("有用:POST /api/qa/:id/feedback 带 rating,选中(brand-50 底 + aria-pressed)", async () => {
    // 3.4.6 起挂载先发 GET 恢复持久化反馈,此处恒回 null;POST 按提交落库
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          (init?.method ?? "GET") === "GET" &&
          String(input).includes("/feedback")
        ) {
          return jsonResponse({ rating: null });
        }
        return jsonResponse({ qa_id: "qa-1", rating: "useful" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AnswerSheet answer="答案" citations={[CITATION]} qaId="qa-1" />,
    );
    const useful = screen.getByRole("button", { name: "有用" }) as HTMLButtonElement;
    // 3.4.6:恢复读取不锁定按钮,点击立即生效(用户提交优先于读取结果)
    fireEvent.click(useful);
    await waitFor(() => expect(useful.getAttribute("aria-pressed")).toBe("true"));
    expect(useful.className).toContain("aria-pressed:bg-brand-50");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/qa/qa-1/feedback");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ rating: "useful" });
  });

  it("无 qaId 时点有用不发请求(测试夹具场景)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AnswerSheet answer="答案" citations={[CITATION]} />);
    fireEvent.click(screen.getByRole("button", { name: "有用" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("操作反馈(3.4.6):互斥 / 防重 / 失败恢复 / 挂载恢复", () => {
  function stubFeedbackFetch(getRating: string | null = null) {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          (init?.method ?? "GET") === "GET" &&
          String(input).includes("/feedback")
        ) {
          return jsonResponse({ rating: getRating });
        }
        return jsonResponse({ qa_id: "qa-1", rating: "useful" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function renderWithFeedback(qaId = "qa-1") {
    render(<AnswerSheet answer="答案正文" citations={[CITATION]} qaId={qaId} />);
  }

  it("互斥选中:点有用选中,再点无用切换(每个版本只有一个状态)", async () => {
    stubFeedbackFetch();
    await renderWithFeedback();
    const useful = screen.getByRole("button", { name: "有用" }) as HTMLButtonElement;
    const useless = screen.getByRole("button", { name: "无用" }) as HTMLButtonElement;
    fireEvent.click(useful);
    await waitFor(() => expect(useful.getAttribute("aria-pressed")).toBe("true"));
    expect(useful.className).toContain("aria-pressed:bg-brand-50");
    expect(useless.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(useless);
    await waitFor(() => expect(useless.getAttribute("aria-pressed")).toBe("true"));
    // 选中态由 aria-pressed 属性驱动(变体类为静态 class,样式随属性生效)
    expect(useful.getAttribute("aria-pressed")).toBe("false");
    expect(useless.className).toContain("aria-pressed:bg-brand-50");
  });

  it("重复点击同一项:保持选中,不重复提交(仅一次 POST)", async () => {
    const fetchMock = stubFeedbackFetch();
    await renderWithFeedback();
    fireEvent.click(screen.getByRole("button", { name: "有用" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "有用" }) as HTMLButtonElement)
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    fireEvent.click(screen.getByRole("button", { name: "有用" }));
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(
      (screen.getByRole("button", { name: "有用" }) as HTMLButtonElement)
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("挂载恢复持久化反馈:GET 返回 useless → 无需点击即选中(刷新不丢)", async () => {
    stubFeedbackFetch("useless");
    render(<AnswerSheet answer="答案正文" citations={[CITATION]} qaId="qa-1" />);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "无用" }) as HTMLButtonElement)
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(
      (screen.getByRole("button", { name: "有用" }) as HTMLButtonElement)
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("提交失败:恢复未选中 + 轻量提示「反馈提交失败,请重试」,3s 后自动消失", async () => {
    vi.useFakeTimers();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ error: "QA 记录不存在" }, 404)),
      );
      render(<AnswerSheet answer="答案正文" citations={[CITATION]} qaId="qa-1" />);
      const useful = screen.getByRole("button", { name: "有用" }) as HTMLButtonElement;
      fireEvent.click(useful);
      await act(async () => {});
      expect(useful.getAttribute("aria-pressed")).toBe("false");
      expect(screen.getByText("反馈提交失败,请重试")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByText("反馈提交失败,请重试")).toBeNull();
    } finally {
      consoleWarn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("previous 变体:复制 + 有用/无用绑定自己的 qa_id(按版本独立,不串到最新)", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (
          (init?.method ?? "GET") === "GET" &&
          String(input).includes("/feedback")
        ) {
          return jsonResponse({ rating: null });
        }
        return jsonResponse({ qa_id: "qa-old", rating: "useful" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AnswerSheet
        variant="previous"
        answer="旧答案"
        citations={[CITATION]}
        qaId="qa-old"
      />,
    );
    expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "有用" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "有用" }) as HTMLButtonElement)
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/qa/qa-old/feedback");
  });
});

describe("复制回答反馈(3.4.6)", () => {
  function stubClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  }

  it("复制成功:仅真实 Clipboard 成功后显示「✓ 已复制」,1.8s 后恢复", async () => {
    vi.useFakeTimers();
    try {
      const writeText = vi.fn(async () => {});
      stubClipboard(writeText);
      render(<AnswerSheet answer="答案正文" citations={[CITATION]} />);
      fireEvent.click(screen.getByRole("button", { name: "复制回答" }));
      await act(async () => {});
      // 复制内容 = AI 回答原文(不改既有复制数据契约)
      expect(writeText).toHaveBeenCalledWith("答案正文");
      const copied = screen.getByRole("button", { name: "✓ 已复制" });
      expect(copied.className).toContain("data-[copied=true]:text-success-text");
      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("复制失败(Clipboard 被拒):「复制失败,请重试」后恢复,不暴露技术错误", async () => {
    vi.useFakeTimers();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      stubClipboard(async () => {
        throw new DOMException("denied", "NotAllowedError");
      });
      render(<AnswerSheet answer="答案正文" citations={[CITATION]} />);
      fireEvent.click(screen.getByRole("button", { name: "复制回答" }));
      await act(async () => {});
      expect(screen.getByRole("button", { name: "复制失败,请重试" })).toBeTruthy();
      expect(screen.queryByText(/NotAllowedError/)).toBeNull();
      expect(consoleWarn).toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
    } finally {
      consoleWarn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("Clipboard 不可用:走失败反馈,不静默、不抛错", async () => {
    vi.useFakeTimers();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
      render(<AnswerSheet answer="答案正文" citations={[CITATION]} />);
      fireEvent.click(screen.getByRole("button", { name: "复制回答" }));
      await act(async () => {});
      expect(screen.getByRole("button", { name: "复制失败,请重试" })).toBeTruthy();
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      consoleWarn.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("版本管理(3.4.4):最新主卡 / 上一版弱化 / 加载态 / 一致提示", () => {
  it("latest 默认变体:眉题「AI 回答」+「最新」标 + 版本标注 + 完整操作行", () => {
    render(
      <AnswerSheet
        answer="答案正文"
        citations={[CITATION]}
        versionMeta="v2 · 刚刚生成"
      />,
    );
    expect(screen.getByText("AI 回答")).toBeTruthy();
    expect(screen.getByText("最新")).toBeTruthy();
    expect(screen.getByText("v2 · 刚刚生成")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "有用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "无用" })).toBeTruthy();
  });

  it("previous 变体:眉题「上一版回答」,无「最新」标,操作行 = 复制+有用/无用,无重新生成", () => {
    render(
      <AnswerSheet variant="previous" answer="旧答案" citations={[CITATION]} />,
    );
    expect(screen.getByText("上一版回答")).toBeTruthy();
    expect(screen.queryByText("最新")).toBeNull();
    expect(screen.queryByRole("button", { name: "重新生成" })).toBeNull();
    // 3.4.6:上一版也展示反馈入口,状态按本版本 qa_id 独立存取
    expect(screen.getByRole("button", { name: "有用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "无用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
  });

  it("generating:卡内加载态(单请求单文案,不伪造多阶段),无正文/依据/操作行", () => {
    render(<AnswerSheet answer="旧答案" citations={[CITATION]} generating />);
    expect(screen.getByText("AI 回答")).toBeTruthy();
    expect(screen.getByText("正在重新生成")).toBeTruthy();
    expect(screen.getByText("正在重新生成回答…")).toBeTruthy();
    expect(screen.getByText("正在检索企业知识库并生成回答")).toBeTruthy();
    expect(screen.queryByText("旧答案")).toBeNull();
    expect(screen.queryByRole("button", { name: "重新生成" })).toBeNull();
    expect(screen.queryByText(/依据与来源/)).toBeNull();
  });

  it("sameNotice:显示「本次回答与上一版一致」提示,不新增卡片", () => {
    render(<AnswerSheet answer="答案正文" citations={[CITATION]} sameNotice />);
    expect(
      screen.getByText("已完成重新生成,本次回答与上一版一致。"),
    ).toBeTruthy();
    expect(screen.getByText("答案正文")).toBeTruthy();
  });

  it("conflicts:Trust 提示内嵌在正文与依据之间(3.4.5,非独立大卡)", () => {
    const conflicts: ConflictItem[] = [
      {
        doc_a: "doc-a",
        doc_b: "doc-b",
        quote_a: "每日上限 100 元。",
        quote_b: "每日上限 150 元。",
      },
    ];
    render(
      <AnswerSheet
        answer="答案正文"
        citations={[CITATION]}
        conflicts={conflicts}
      />,
    );
    const alert = screen.getByText("发现 2 份文档存在口径差异");
    const evidence = screen.getByText("依据与来源(1)");
    // 提示位于依据带之前(DOCUMENT_POSITION_FOLLOWING = 4)
    expect(
      (alert.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
  });
});
