import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  isSupportedFormat,
  SUPPORTED_FORMATS,
  UploadZone,
} from "@/components/documents/upload-zone";

/* UploadZone(DesignSystem #8 + 2026-09-14 人规格):点击/键盘/拖拽三通道、
   禁用态、格式校验、五级信息层级;Default/Hover/DragOver/Error/Uploading
   五态(Hover 为 CSS-only 不测,其余四态类名与文案断言);错误经卡内
   role=alert 呈现。 */

describe("isSupportedFormat", () => {
  it("大小写不敏感地匹配 5 种受支持扩展名", () => {
    expect(isSupportedFormat("a.MD")).toBe(true);
    expect(isSupportedFormat("a.md")).toBe(true);
    expect(isSupportedFormat("a.pdf")).toBe(true);
    expect(isSupportedFormat("a.docx")).toBe(true);
    expect(isSupportedFormat("a.html")).toBe(true);
    expect(isSupportedFormat("a.txt")).toBe(true);
  });

  it("拒绝其他格式与无扩展名", () => {
    expect(isSupportedFormat("a.png")).toBe(false);
    expect(isSupportedFormat("a.xlsx")).toBe(false);
    expect(isSupportedFormat("README")).toBe(false);
  });

  it("与 SUPPORTED_FORMATS 常量一致", () => {
    expect(SUPPORTED_FORMATS).toEqual([".md", ".pdf", ".docx", ".html", ".txt"]);
  });
});

describe("UploadZone", () => {
  it("渲染五级信息层级:图标 + 主标题 + 操作提示 + 支持格式 + 限制说明(2026-09-14 人规格)", () => {
    const { container } = render(<UploadZone onBrowse={() => {}} onFile={() => {}} />);
    // 线性 Upload 图标(装饰性,aria-hidden)
    expect(container.querySelector("svg")).toBeTruthy();
    // 主标题 = 主要视觉信息(heading-2 明显高于说明文字)
    const title = screen.getByText("拖入或选择文档");
    expect(title.className).toContain("text-heading-2");
    expect(screen.getByText("点击选择文件,或将文件拖拽到此处")).toBeTruthy();
    expect(screen.getByText(".md / .pdf / .docx / .html / .txt")).toBeTruthy();
    expect(
      screen.getByText("不支持扫描件 OCR,请先将扫描件转换为文本"),
    ).toBeTruthy();
  });

  it("点击触发 onBrowse", () => {
    const onBrowse = vi.fn();
    render(<UploadZone onBrowse={onBrowse} onFile={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "拖入或选择文档上传" }));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it("键盘 Enter 与 Space 触发 onBrowse", () => {
    const onBrowse = vi.fn();
    render(<UploadZone onBrowse={onBrowse} onFile={() => {}} />);
    const zone = screen.getByRole("button", { name: "拖入或选择文档上传" });
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.keyDown(zone, { key: " " });
    expect(onBrowse).toHaveBeenCalledTimes(2);
  });

  it("拖拽 drop 文件 → onFile(取首个文件)", () => {
    const onFile = vi.fn();
    render(<UploadZone onBrowse={() => {}} onFile={onFile} />);
    const file = new File(["demo"], "a.md", { type: "text/markdown" });
    fireEvent.drop(screen.getByRole("button", { name: "拖入或选择文档上传" }), {
      dataTransfer: { files: [file] },
    });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("禁用态:点击/键盘/drop 均不触发,且不可聚焦", () => {
    const onBrowse = vi.fn();
    const onFile = vi.fn();
    render(
      <UploadZone onBrowse={onBrowse} onFile={onFile} disabled />,
    );
    const zone = screen.getByRole("button", { name: "拖入或选择文档上传" });
    expect(zone.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(zone);
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["x"], "a.md")] },
    });
    expect(onBrowse).not.toHaveBeenCalled();
    expect(onFile).not.toHaveBeenCalled();
  });

  it("drag over:品牌蓝实线 + 浅蓝底 + 提示原位换「松开鼠标以上传」,dragLeave 复位", () => {
    render(<UploadZone onBrowse={() => {}} onFile={() => {}} />);
    const zone = screen.getByRole("button", { name: "拖入或选择文档上传" });
    fireEvent.dragEnter(zone);
    expect(zone.className).toContain("border-solid");
    expect(zone.className).toContain("border-brand-600");
    expect(zone.className).toContain("bg-brand-50");
    // 操作提示原位换文案,不增行(布局稳定)
    expect(screen.getByText("松开鼠标以上传")).toBeTruthy();
    expect(screen.queryByText("点击选择文件,或将文件拖拽到此处")).toBeNull();
    fireEvent.dragLeave(zone);
    expect(screen.getByText("点击选择文件,或将文件拖拽到此处")).toBeTruthy();
  });

  it("error:danger 虚线 + 浅红底,错误行在卡内 role=alert(错误就在操作区)", () => {
    render(
      <UploadZone
        onBrowse={() => {}}
        onFile={() => {}}
        error="文件格式不支持,请选择 .md / .pdf / .docx / .html / .txt 文件"
      />,
    );
    const zone = screen.getByRole("button", { name: "拖入或选择文档上传" });
    expect(zone.className).toContain("border-danger");
    expect(zone.className).toContain("bg-danger-bg");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("文件格式不支持");
    expect(zone.contains(alert)).toBe(true);
  });

  it("上传中:标题换「正在上传 {name}…」,全通道禁用,无 drag over 提示", () => {
    const onBrowse = vi.fn();
    const onFile = vi.fn();
    render(
      <UploadZone
        onBrowse={onBrowse}
        onFile={onFile}
        uploadingName="新政策.md"
      />,
    );
    const zone = screen.getByRole("button", { name: "拖入或选择文档上传" });
    expect(screen.getByText("正在上传 新政策.md…")).toBeTruthy();
    expect(screen.getByText("上传中,请稍候…")).toBeTruthy();
    expect(zone.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(zone);
    fireEvent.dragEnter(zone);
    expect(screen.queryByText("松开鼠标以上传")).toBeNull();
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["x"], "a.md")] },
    });
    expect(onBrowse).not.toHaveBeenCalled();
    expect(onFile).not.toHaveBeenCalled();
  });
});
