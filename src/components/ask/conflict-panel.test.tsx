import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConflictPanel } from "@/components/ask/conflict-panel";
import type { Citation, ConflictItem } from "@/lib/rag";

/* L3 组件测试(3.4.5 重做):Trust Alert 默认收起 / 展开收起 / citations 富化
   (标题/上传时间/查看原文 → 来源抽屉)/ 无 citation 降级 / 多对冲突文档去重。 */

const CONFLICTS: ConflictItem[] = [
  {
    doc_a: "doc-hr-03",
    doc_b: "doc-hr-04",
    quote_a: "市内交通费每天上限 100 元。",
    quote_b: "市内交通费每天上限 150 元。",
  },
];

const CITATION_A: Citation = {
  index: 1,
  doc_id: "doc-hr-03",
  chunk_id: "doc-hr-03-0",
  quote: "市内交通费每天上限 100 元。",
  text: "市内交通费每天上限 100 元。",
  source: "hybrid",
  score: 0.8,
  doc_title: "差旅费用报销制度(2024 版)",
  doc_format: "md",
  doc_status: "indexed",
  doc_uploaded_at: "2026-09-01T00:00:00",
};

const CITATION_B: Citation = {
  ...CITATION_A,
  index: 2,
  doc_id: "doc-hr-04",
  chunk_id: "doc-hr-04-0",
  quote: "市内交通费每天上限 150 元。",
  text: "市内交通费每天上限 150 元。",
  doc_title: "差旅费用报销制度(2026 版)",
};

describe("ConflictPanel Trust Alert(3.4.5)", () => {
  it("默认收起:仅轻量提示与「查看冲突来源」入口,不展开来源内容", () => {
    render(<ConflictPanel conflicts={CONFLICTS} />);
    expect(screen.getByText("发现 2 份文档存在口径差异")).toBeTruthy();
    expect(
      screen.getByText("不同文档对同一规则存在不同表述,KnowFlow 不替您选边。"),
    ).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "查看冲突来源" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // 不默认展开两个完整来源
    expect(screen.queryByText(/上限 100 元/)).toBeNull();
    expect(screen.queryByText(/上限 150 元/)).toBeNull();
  });

  it("点击「查看冲突来源」展开双方来源卡,再点收起", () => {
    render(<ConflictPanel conflicts={CONFLICTS} />);
    fireEvent.click(screen.getByRole("button", { name: "查看冲突来源" }));
    expect(screen.getByText(/上限 100 元/)).toBeTruthy();
    expect(screen.getByText(/上限 150 元/)).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "收起冲突来源" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(screen.queryByText(/上限 100 元/)).toBeNull();
  });

  it("citations 富化:标题/上传时间,「查看原文」打开对应来源抽屉", () => {
    render(
      <ConflictPanel conflicts={CONFLICTS} citations={[CITATION_A, CITATION_B]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "查看冲突来源" }));
    expect(screen.getByText("差旅费用报销制度(2024 版)")).toBeTruthy();
    expect(screen.getByText("差旅费用报销制度(2026 版)")).toBeTruthy();
    expect(screen.getAllByText("上传于 2026-09-01")).toHaveLength(2);
    // 两份来源都可进入原文(复用 SourceDrawer,不新造查看器)
    const openButtons = screen.getAllByRole("button", { name: "查看原文" });
    expect(openButtons).toHaveLength(2);
    fireEvent.click(openButtons[0]);
    expect(
      screen.getByRole("dialog", {
        name: "来源 [1]:差旅费用报销制度(2024 版)",
      }),
    ).toBeTruthy();
  });

  it("无匹配 citation 时降级:doc_id 作标题,不显示「查看原文」与上传时间", () => {
    render(<ConflictPanel conflicts={CONFLICTS} />);
    fireEvent.click(screen.getByRole("button", { name: "查看冲突来源" }));
    expect(screen.getByText("doc-hr-03")).toBeTruthy();
    expect(screen.getByText("doc-hr-04")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看原文" })).toBeNull();
    expect(screen.queryByText(/上传于/)).toBeNull();
  });

  it("多对冲突:提示中的文档数按去重口径", () => {
    render(
      <ConflictPanel
        conflicts={[
          CONFLICTS[0],
          { doc_a: "doc-hr-03", doc_b: "doc-prod-01", quote_a: "甲", quote_b: "乙" },
        ]}
      />,
    );
    expect(screen.getByText("发现 3 份文档存在口径差异")).toBeTruthy();
  });
});
