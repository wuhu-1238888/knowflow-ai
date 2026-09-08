import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge(DesignSystem: 22px 高/圆角 6px/方形)", () => {
  it("默认 neutral:次级表面 + 次级文字", () => {
    render(<Badge>待索引</Badge>);
    const badge = screen.getByText("待索引");
    expect(badge.className).toContain("bg-surface-2");
    expect(badge.className).toContain("text-ink-2");
  });

  it("文档状态语义:success/info/danger 映射固定", () => {
    const { rerender } = render(<Badge variant="success">已索引</Badge>);
    expect(screen.getByText("已索引").className).toContain("bg-success-bg");
    rerender(<Badge variant="info">解析中</Badge>);
    expect(screen.getByText("解析中").className).toContain("bg-info-bg");
    rerender(<Badge variant="danger">解析失败</Badge>);
    expect(screen.getByText("解析失败").className).toContain("bg-danger-bg");
  });

  it("检索模式徽标:三模式各有专属底色", () => {
    const { rerender } = render(<Badge variant="mode-hybrid">混合+重排</Badge>);
    expect(screen.getByText("混合+重排").className).toContain(
      "bg-mode-hybrid-bg",
    );
    rerender(<Badge variant="mode-vector">向量</Badge>);
    expect(screen.getByText("向量").className).toContain("bg-mode-vector-bg");
    rerender(<Badge variant="mode-keyword">关键词</Badge>);
    expect(screen.getByText("关键词").className).toContain(
      "bg-mode-keyword-bg",
    );
  });

  it("方形圆角,非胶囊(胶囊为 AI 状态白名单)", () => {
    render(<Badge>已索引</Badge>);
    const badge = screen.getByText("已索引");
    expect(badge.className).toContain("rounded-sm");
    expect(badge.className).not.toContain("rounded-full");
    expect(badge.className).not.toContain("rounded-pill");
  });
});
