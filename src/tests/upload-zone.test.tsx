import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  isSupportedFormat,
  SUPPORTED_FORMATS,
  UploadZone,
} from "@/components/documents/upload-zone";

/* UploadZone(DesignSystem #8):点击/键盘/拖拽三通道、禁用态、格式校验、
   无 OCR 说明;错误经 role=alert 呈现。 */

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
  it("渲染标题、格式 mono 列表与无 OCR 说明", () => {
    render(<UploadZone onBrowse={() => {}} onFile={() => {}} />);
    expect(screen.getByText("拖入或选择文档")).toBeTruthy();
    expect(screen.getByText(".md .pdf .docx .html .txt")).toBeTruthy();
    expect(screen.getByText(/不支持 OCR/)).toBeTruthy();
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

  it("error 经 role=alert 呈现", () => {
    render(
      <UploadZone onBrowse={() => {}} onFile={() => {}} error="暂不支持 .png 格式" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("暂不支持 .png 格式");
  });
});
