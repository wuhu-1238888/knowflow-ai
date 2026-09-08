import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button(DesignSystem: 36px 高/圆角 6px/14px 标签)", () => {
  it("默认渲染 primary:品牌底色 + 逆色文字", () => {
    render(<Button>提问</Button>);
    const btn = screen.getByRole("button", { name: "提问" });
    expect(btn.className).toContain("bg-brand-600");
    expect(btn.className).toContain("text-ink-inverse");
    expect(btn.className).toContain("rounded-sm");
    expect(btn.className).toContain("h-9");
  });

  it("secondary:白底 + 发丝线强描边", () => {
    render(<Button variant="secondary">取消</Button>);
    const btn = screen.getByRole("button", { name: "取消" });
    expect(btn.className).toContain("bg-surface");
    expect(btn.className).toContain("border-hairline-strong");
    expect(btn.className).not.toContain("bg-brand-600");
  });

  it("danger:危险色底(仅删除确认使用)", () => {
    render(<Button variant="danger">删除</Button>);
    expect(screen.getByRole("button", { name: "删除" }).className).toContain(
      "bg-danger",
    );
  });

  it("禁用态:surface-2 底 + 禁用文字色,属性 disabled", () => {
    render(<Button disabled>提交</Button>);
    const btn = screen.getByRole("button", { name: "提交" });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("disabled:bg-surface-2");
    expect(btn.className).toContain("disabled:text-ink-disabled");
  });

  it("icon 尺寸:32px 方形", () => {
    render(
      <Button variant="icon" size="icon" aria-label="打开菜单">
        ≡
      </Button>,
    );
    expect(screen.getByRole("button", { name: "打开菜单" }).className).toContain(
      "size-8",
    );
  });

  it("默认 type 为 button(避免表单误提交)", () => {
    render(<Button>保存</Button>);
    expect(screen.getByRole("button", { name: "保存" })).toHaveAttribute(
      "type",
      "button",
    );
  });
});
