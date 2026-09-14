import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  isSupportedFormat,
  SUPPORTED_FORMATS,
  UploadZone,
} from "@/components/documents/upload-zone";

/* UploadZone(DesignSystem #8 + 2026-09-14 人规格,当日回调收紧):点击/键盘/
   拖拽三通道、禁用态、格式校验;信息层级 = 图标(20px)/主标题/支持格式/OCR
   (操作提示行已删);Default/Hover/DragOver/Error/Uploading 五态(Hover 为
   CSS-only 不测,其余四态类名与文案断言);拖拽/上传中提示在支持格式行原位换文;
   错误经卡内 role=alert 呈现。 */

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
  it("渲染信息层级:图标(20px) + 主标题 + 支持格式 + 限制说明,无操作提示行(2026-09-14 回调)", () => {
    const { container } = render(<UploadZone onBrowse={() => {}} onFile={() => {}} />);
    // 线性 Upload 图标(装饰性,aria-hidden;回调缩小到 20px)
    const icon = container.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon!.getAttribute("class")).toContain("size-5");
    // 主标题 = 主要视觉信息(heading-2 明显高于说明文字)
    const title = screen.getByText("拖入或选择文档");
    expect(title.className).toContain("text-heading-2");
    expect(screen.getByText(".md / .pdf / .docx / .html / .txt")).toBeTruthy();
    expect(
      screen.getByText("不支持扫描件 OCR,请先将扫描件转换为文本"),
    ).toBeTruthy();
    // 回调:操作提示行删除(人拍板去冗余,保留三行)
    expect(screen.queryByText("点击选择文件,或将文件拖拽到此处")).toBeNull();
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
    // 支持格式行原位换文案,不增行(布局稳定)
    expect(screen.getByText("松开鼠标以上传")).toBeTruthy();
    expect(screen.queryByText(".md / .pdf / .docx / .html / .txt")).toBeNull();
    fireEvent.dragLeave(zone);
    expect(screen.getByText(".md / .pdf / .docx / .html / .txt")).toBeTruthy();
    expect(screen.queryByText("松开鼠标以上传")).toBeNull();
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
    // 支持格式行已原位换成上传提示,不增行
    expect(screen.queryByText(".md / .pdf / .docx / .html / .txt")).toBeNull();
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
