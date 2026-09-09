import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmModal } from "@/components/documents/confirm-modal";

/* ConfirmModal(DesignRules 文档库页):danger 二次确认;Esc/点遮罩关闭;
   处理中锁定(按钮禁用 + 关闭通道失效);错误经 role=alert 呈现。 */

function renderModal(
  props: Partial<Parameters<typeof ConfirmModal>[0]> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmModal
      title="删除文档"
      description={<>确定删除「a.md」吗?</>}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

function overlayOf() {
  const dialog = screen.getByRole("dialog");
  return dialog.parentElement!.firstElementChild!;
}

describe("ConfirmModal", () => {
  it("渲染标题、描述与「取消/确认删除」按钮,aria 语义完整", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("删除文档")).toBeTruthy();
    expect(screen.getByText(/确定删除「a\.md」吗/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "取消" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认删除" })).toBeTruthy();
  });

  it("确认 → onConfirm;取消 → onCancel", () => {
    const { onConfirm, onCancel } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("点遮罩 → onCancel;点对话框本体不触发", () => {
    const { onCancel } = renderModal();
    fireEvent.click(overlayOf());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Esc → onCancel", () => {
    const { onCancel } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("pending:按钮禁用,Esc 与点遮罩均不关闭", () => {
    const { onConfirm, onCancel } = renderModal({ pending: true });
    expect(
      (screen.getByRole("button", { name: "确认删除" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "取消" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(overlayOf());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("error 经 role=alert 呈现在模态内", () => {
    renderModal({ error: "删除失败,请稍后重试" });
    expect(screen.getByRole("alert")).toHaveTextContent("删除失败,请稍后重试");
  });
});
