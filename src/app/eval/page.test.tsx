import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EvalPage from "@/app/eval/page";

/* L3 评测页(3.3.4 提前切片)测试:三策略对比表只展示实测数字,
   未实现指标显式「暂无数据」;选型叙事诚实(不虚构「提升 X%」)。 */

describe("EvalPage 检索策略对比", () => {
  it("渲染三种策略行,实测数字来自 run JSON 快照", () => {
    render(<EvalPage />);
    expect(screen.getByRole("columnheader", { name: "检索策略" })).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getByText(/向量搜索/)).toBeTruthy();
    expect(within(table).getByText(/混合搜索/)).toBeTruthy();
    expect(within(table).getByText(/混合\+重排/)).toBeTruthy();
    // 实测值:vector 12/12 0.9583、hybrid 12/12 0.9028、hybrid_rerank 12/12 0.9583
    expect(within(table).getAllByText("12/12")).toHaveLength(3);
    expect(within(table).getAllByText("0.9583")).toHaveLength(2);
    expect(within(table).getByText("0.9028")).toBeTruthy();
  });

  it("未纳入评测引擎的指标显式标注暂无数据(3 模式 × 3 指标,禁止虚构)", () => {
    render(<EvalPage />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("暂无数据")).toHaveLength(9);
    expect(screen.getByText(/该指标尚未纳入评测引擎,不做虚构/)).toBeTruthy();
  });

  it("混合+重排行标注「当前默认」,数据来源页脚可回溯", () => {
    render(<EvalPage />);
    const table = screen.getByRole("table");
    const defaultRow = within(table).getByText(/混合\+重排/).closest("tr");
    expect(defaultRow).toBeTruthy();
    expect(defaultRow?.textContent).toContain("当前默认");
    expect(screen.getByText(/run-2026-09-09T063730Z/)).toBeTruthy();
    expect(screen.getByText(/params_hash 365740ee/)).toBeTruthy();
    expect(screen.getByText(/doc_commit 6190456/)).toBeTruthy();
  });

  it("选型叙事诚实:默认 Hybrid + Rerank,但不虚构提升幅度", () => {
    render(<EvalPage />);
    expect(screen.getByText("KnowFlow 当前默认使用 Hybrid + Rerank。")).toBeTruthy();
    expect(screen.getByText(/不预设「重排一定最好」/)).toBeTruthy();
    expect(screen.queryByText(/提升 \d+%/)).toBeNull();
  });
});
