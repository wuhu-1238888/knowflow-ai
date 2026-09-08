import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";

describe("Sidebar(224px 白底 + 右侧发丝线,四页导航)", () => {
  it("渲染四个导航项与版本号", () => {
    render(<Sidebar pathname="/" />);
    expect(screen.getByRole("link", { name: "知识问答" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "文档库" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "评测" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "关于" })).toBeTruthy();
    expect(screen.getByText("v0.1.0")).toBeTruthy();
  });

  it("当前路径项呈激活态(brand-100 底 + brand-800 文字)", () => {
    render(<Sidebar pathname="/documents" />);
    const active = screen.getByRole("link", { name: "文档库" });
    expect(active.className).toContain("bg-brand-100");
    expect(active.className).toContain("text-brand-800");
    const inactive = screen.getByRole("link", { name: "知识问答" });
    expect(inactive.className).not.toContain("bg-brand-100");
  });

  it("标注演示数据为虚构(synthetic 声明)", () => {
    render(<Sidebar pathname="/" />);
    expect(screen.getByText(/synthetic/i)).toBeTruthy();
  });
});

describe("TopBar(<1024px 顶栏 + 抽屉菜单)", () => {
  it("点击菜单按钮打开抽屉,内含四页导航;点遮罩关闭", () => {
    render(<TopBar pathname="/" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.querySelectorAll("a")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "关闭导航菜单" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
