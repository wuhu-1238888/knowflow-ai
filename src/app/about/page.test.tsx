import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AboutPage from "@/app/about/page";

/* L3 关于页测试(3.3.5):四区块齐全(定位一句话 / synthetic 声明卡 /
 * 技术栈 mono / 边界说明摘要)、声明完整且不把 NovaTech 描述为真实企业
 * 客户或真实商业项目(DesignRules 专属禁令)、技术栈数值与仓库实况一致。 */

describe("AboutPage 结构与定位一句话", () => {
  it("页头「关于」+ 四个区块标题齐全", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { name: "关于", level: 1 }),
    ).toBeTruthy();
    for (const title of ["产品定位", "演示数据声明", "技术栈", "产品边界"]) {
      expect(
        screen.getByRole("heading", { name: title, level: 2 }),
      ).toBeTruthy();
    }
  });

  it("定位一句话与 product-vision 定稿口径一致(三大承诺齐全)", () => {
    render(<AboutPage />);

    const positioning = screen.getByRole("region", { name: "产品定位" });
    const text = positioning.textContent ?? "";
    expect(text).toContain("面向企业新员工的 AI 知识助手");
    expect(text).toContain("带来源引用");
    expect(text).toContain("明确拒答");
    expect(text).toContain("可复现的检索质量实测数据");
  });
});

describe("AboutPage 演示数据声明(synthetic)", () => {
  it("声明卡内容完整:NovaTech 虚构企业 + synthetic 标注 + 用途", () => {
    render(<AboutPage />);

    const card = screen.getByRole("region", { name: "演示数据声明" });
    expect(within(card).getByText(/虚构企业/)).toBeTruthy();
    expect(within(card).getByText(/NovaTech/)).toBeTruthy();
    expect(within(card).getByText(/synthetic: true/)).toBeTruthy();
    expect(within(card).getByText(/仅用于产品演示与检索质量评测/)).toBeTruthy();
    expect(within(card).getByText(/不指向任何真实企业/)).toBeTruthy();
  });

  it("全文不将 NovaTech 描述为真实企业客户或真实商业项目(专属禁令)", () => {
    render(<AboutPage />);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/真实企业客户/);
    expect(text).not.toMatch(/真实商业项目/);
    expect(text).toContain("不接入任何真实企业数据");
  });

  it("声明卡为中性卡片:surface 底 + hairline 描边 + rounded-lg", () => {
    render(<AboutPage />);

    const card = screen.getByRole("region", { name: "演示数据声明" });
    // 声明正文所在卡片容器(正文 <p> 最近的 div 祖先即卡片)
    const container = within(card).getByText(/虚构企业/).closest("div");
    expect(container?.className ?? "").toContain("border-hairline");
    expect(container?.className ?? "").toContain("bg-surface");
    expect(container?.className ?? "").toContain("rounded-lg");
  });
});

describe("AboutPage 技术栈(mono)", () => {
  it("条目与仓库实况一致:Next.js/FastAPI/LanceDB/bge/DeepSeek/Mock", () => {
    render(<AboutPage />);

    const stack = screen.getByRole("region", { name: "技术栈" });
    const text = stack.textContent ?? "";
    expect(text).toContain("Next.js 15(App Router)");
    expect(text).toContain("React 19");
    expect(text).toContain("FastAPI");
    expect(text).toContain("LanceDB(向量 · BM25 全文倒排)");
    expect(text).toContain("bge-m3(Embedding)");
    expect(text).toContain("bge-reranker-v2-m3(重排)");
    expect(text).toContain("DeepSeek API(Key 由用户配置)");
    expect(text).toContain("Mock 默认");
  });

  it("技术栈值全部使用 mono 字体", () => {
    render(<AboutPage />);

    const stack = screen.getByRole("region", { name: "技术栈" });
    const values = stack.querySelectorAll("dd");
    expect(values.length).toBe(6);
    values.forEach((dd) => {
      expect(dd.className).toContain("font-mono");
    });
  });
});

describe("AboutPage 产品边界(不做清单摘要)", () => {
  it("呈现不做清单摘要:多租户/OCR/Agent/集成/真实数据", () => {
    render(<AboutPage />);

    const boundary = screen.getByRole("region", { name: "产品边界" });
    const text = boundary.textContent ?? "";
    expect(text).toContain("多租户与权限体系(RBAC / SSO)");
    expect(text).toContain("多模态 RAG / OCR");
    expect(text).toContain("Agent 自主任务 / 会话记忆 / Tool Calling");
    expect(text).toContain("企业系统集成(IM / 网盘 / CRM)");
    expect(text).toContain("接入真实企业数据");
    // 摘要而非全文:不带 PRD 清单中的逐条扩展说明
    expect(text).toContain("MVP 为单租户演示");
    expect(text).toContain("「克隆即可跑」");
  });
});
