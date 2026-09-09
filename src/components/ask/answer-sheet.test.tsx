import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerSheet, formatAnswer } from "./answer-sheet";

/* formatAnswer:轻量清洗 markdown 符号后按行保留,answer 展示前必经此函数。 */

describe("formatAnswer", () => {
  it("去除加粗、行内代码与标题井号,保留换行", () => {
    expect(formatAnswer("**重点** 与 `代码` 并存")).toBe("重点 与 代码 并存");
    expect(formatAnswer("## 标题\n正文第一行\n正文第二行")).toBe("标题\n正文第一行\n正文第二行");
  });

  it("无 markdown 符号时原样返回", () => {
    expect(formatAnswer("普通回答,无符号。")).toBe("普通回答,无符号。");
  });
});

describe("AnswerSheet", () => {
  it("渲染 AI 眉题、元信息行与依据带(含复制按钮),元信息不含工程调试值", () => {
    render(
      <AnswerSheet
        answer="答案正文"
        citations={[
          { index: 1, doc_id: "doc-1", chunk_id: "doc-1#0", quote: "引用片段" },
        ]}
      />,
    );
    expect(screen.getByText("AI 回答")).toBeTruthy();
    expect(screen.getByText("已基于企业知识库检索")).toBeTruthy();
    expect(screen.getByText("依据与来源(1)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制回答" })).toBeTruthy();
    // 2026-09-09 人拍板:模式徽标/最高分/耗时不出现在主流程
    expect(screen.queryByText(/最高分/)).toBeNull();
    expect(screen.queryByText(/耗时/)).toBeNull();
  });

  it("无依据时不渲染依据带", () => {
    render(<AnswerSheet answer="答案正文" citations={[]} />);
    expect(screen.queryByText(/依据与来源/)).toBeNull();
  });
});
