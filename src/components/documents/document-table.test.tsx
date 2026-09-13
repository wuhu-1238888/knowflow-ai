import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocumentTable } from "@/components/documents/document-table";
import type { DocumentInfo } from "@/lib/rag";

/* L3 文档表格列对齐测试(2026-09-13 人拍板):
   标题左对齐(主要识别信息);格式/状态/分块数/上传时间/操作五列
   表头与内容统一居中;操作按钮整体居中(flex justify-center)。
   对齐为列级规则,断言 class 层面锁定,防回归。 */

const DOC: DocumentInfo = {
  id: "doc-1",
  title: "员工手册.md",
  file_type: "md",
  status: "indexed",
  uploaded_at: "2026-09-05T10:30:00",
  synthetic: 0,
  chunk_count: 5,
};

function renderTable() {
  return render(
    <DocumentTable
      docs={[DOC]}
      uploading={null}
      reindexing={[]}
      reindexErrors={{}}
      onDelete={() => {}}
      onReindex={() => {}}
    />,
  );
}

describe("DocumentTable 列对齐(2026-09-13)", () => {
  it("表头:文档标题左对齐,格式/状态/分块数/上传时间/操作五列居中", () => {
    renderTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((th) => th.textContent)).toEqual([
      "文档标题",
      "格式",
      "状态",
      "分块数",
      "上传时间",
      "操作",
    ]);
    // 第 1 列(标题)左对齐,其余五列统一居中
    expect(headers[0].className).not.toContain("text-center");
    headers.slice(1).forEach((th) =>
      expect(th.className).toContain("text-center"),
    );
  });

  it("内容行:标题单元格左对齐,其余五列居中;操作按钮整体居中", () => {
    const { container } = renderTable();
    const row = container.querySelector("tbody tr") as HTMLTableRowElement;
    const cells = Array.from(row.querySelectorAll("td"));
    expect(cells).toHaveLength(6);

    // 标题单元格(左对齐)含标题链接;其余五列居中
    expect(cells[0].className).not.toContain("text-center");
    expect(cells[0].querySelector("a")?.textContent).toBe("员工手册.md");
    cells.slice(1).forEach((cell) =>
      expect(cell.className).toContain("text-center"),
    );

    // 操作列:两个 icon 按钮(重建索引/删除)整体居中,无挤压重叠
    const actionBox = cells[5].querySelector("div") as HTMLDivElement;
    expect(actionBox.className).toContain("justify-center");
    expect(actionBox.className).not.toContain("justify-end");
    expect(
      actionBox.querySelectorAll("button"),
    ).toHaveLength(2);
  });
});
