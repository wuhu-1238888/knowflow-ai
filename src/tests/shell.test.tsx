import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";

/* AppShell 依赖 next/navigation 的 usePathname:可变 mock(vi.hoisted 避免提升报错)。 */
const { currentPathname } = vi.hoisted(() => ({ currentPathname: { value: "/" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname.value,
}));

describe("Sidebar(224px 白底 + 右侧发丝线,四页导航)", () => {
  it("渲染四个导航项与版本号", () => {
    render(<Sidebar pathname="/" />);
    expect(screen.getByRole("link", { name: "知识问答" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "文档库" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "评测" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "关于" })).toBeTruthy();
    expect(screen.getByText("v0.1.0")).toBeTruthy();
  });

  it("当前路径项呈激活态(非常浅蓝底 + 深色文字 + 蓝 icon,二轮收蓝)", () => {
    render(<Sidebar pathname="/documents" />);
    const active = screen.getByRole("link", { name: "文档库" });
    expect(active.className).toContain("bg-brand-50");
    expect(active.className).toContain("text-ink");
    expect(active.querySelector("svg")?.getAttribute("class")).toContain(
      "text-brand-600",
    );
    const inactive = screen.getByRole("link", { name: "知识问答" });
    expect(inactive.className).not.toContain("bg-brand-50");
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

describe("AppShell(按路由分档内容容器宽度,DesignSystem containers)", () => {
  it.each([
    ["/", "max-w-[960px]"],
    ["/eval", "max-w-[1152px]"],
    ["/documents", "max-w-[1152px]"],
    ["/about", "max-w-[880px]"],
    ["/unknown", "max-w-[960px]"],
    ["/documents/123", "max-w-[1152px]"],
  ])("%s → main 容器 %s(居中)", (pathname, widthClass) => {
    currentPathname.value = pathname;
    const { container } = render(
      <AppShell>
        <p>内容</p>
      </AppShell>,
    );
    const main = container.querySelector("main");
    expect(main?.className).toContain(widthClass);
    expect(main?.className).toContain("mx-auto");
  });

  it("main 无全局 760px 上限(宽度由路由分档接管)", () => {
    currentPathname.value = "/";
    const { container } = render(
      <AppShell>
        <p>内容</p>
      </AppShell>,
    );
    expect(container.querySelector("main")?.className).not.toContain(
      "max-w-[760px]",
    );
  });
});
