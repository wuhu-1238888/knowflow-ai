import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

/* 关于页(3.3.5;2026-09-14 排版层级优化):产品定位 + NovaTech 虚构数据声明
 * + 技术栈 + 产品边界。纯静态服务端组件;所有事实(定位口径、技术栈、边界)
 * 与 memory-bank 定稿文档及仓库实况(package.json / requirements.txt /
 * technical-design)一致。
 * 层级(2026-09-14 人规格):产品定位 = 页面第一层级(heading-1 20/600);
 * 演示数据声明 / 技术栈 / 产品边界 = 统一第二层级(heading-2 16/500 ink-2),
 * 层级靠字号 + 字重 + 间距建立,不用紫色/渐变。
 * 技术栈 = 左侧浅灰分类徽标 + 正文体系(非 mono)+ 行内边距 py-3 + 行间
 * hairline 分割线;产品边界 = 中性灰圆点列表(统一间距)。
 * 专属禁令:不将 NovaTech 描述为真实企业客户或真实商业项目。 */

const TECH_STACK: { label: string; value: string }[] = [
  {
    label: "前端",
    value: "Next.js 15(App Router)· React 19 · TypeScript · Tailwind CSS 4",
  },
  {
    label: "后端",
    value: "Python · FastAPI · Uvicorn",
  },
  {
    label: "数据",
    value: "SQLite(元数据)· LanceDB(向量 · BM25 全文倒排)",
  },
  {
    label: "检索",
    value: "bge-m3(Embedding)· BM25 关键词 · bge-reranker-v2-m3(重排)",
  },
  {
    label: "生成",
    value: "LLM 适配层(可插拔)· Mock 默认 · DeepSeek API(Key 由用户配置)",
  },
  {
    label: "解析",
    value: "PyMuPDF(pdf)· python-docx(docx)· Markdown / HTML / TXT 规则清洗",
  },
];

const BOUNDARIES: { item: string; reason: string }[] = [
  {
    item: "多租户与权限体系(RBAC / SSO)",
    reason: "MVP 为单租户演示,不做真实权限控制",
  },
  {
    item: "Agent 自主任务 / 会话记忆 / Tool Calling",
    reason: "核心价值是检索质量与可信回答",
  },
  {
    item: "多模态 RAG / OCR",
    reason: "演示文档限定文本型格式(PDF / Markdown / DOCX / HTML / TXT)",
  },
  {
    item: "自训练 Embedding / Reranker",
    reason: "使用现成开源模型,保证评测可复现",
  },
  {
    item: "企业系统集成(IM / 网盘 / CRM)",
    reason: "零集成,保证「克隆即可跑」",
  },
  {
    item: "接入真实企业数据",
    reason: "仅使用 synthetic 标注的虚构演示数据",
  },
];

/* 第二层级 section 标题(2026-09-14 人规格):统一中等字号/字重 + 中性文字色 */
function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-heading-2 font-medium text-ink-2">
      {children}
    </h2>
  );
}

export default function AboutPage() {
  return (
    <div className="pb-4">
      <PageHeader title="关于" />
      <div className="mt-6 space-y-8">
        {/* 定位一句话:product-vision 定稿口径,逐字一致。
            第一层级(2026-09-14 人规格):全页最大 section 标题 + 更强字重 */}
        <section aria-labelledby="positioning">
          <h2 id="positioning" className="text-heading-1 font-semibold text-ink">
            产品定位
          </h2>
          <p className="mt-3 text-body-lg leading-relaxed text-ink">
            KnowFlow AI 是面向企业新员工的 AI 知识助手:用 RAG(向量 + 关键词混合检索 +
            重排)从企业知识库中给出带来源引用的准确回答,知识库没有答案时明确拒答,
            并附带可复现的检索质量实测数据——让企业用户更快、更准确、更可信地获取内部知识。
          </p>
        </section>

        {/* synthetic 声明卡:中性卡片(surface + hairline),正文级排版 */}
        <section aria-labelledby="synthetic">
          <SectionTitle id="synthetic">演示数据声明</SectionTitle>
          <div className="mt-2 rounded-lg border border-hairline bg-surface p-6">
            <p className="text-body-lg leading-relaxed text-ink">
              本产品内置的演示知识库基于虚构企业
              <span className="font-medium"> NovaTech</span>——一家虚构的 SaaS
              软件公司,不指向任何真实企业。
            </p>
            <p className="mt-3 text-body-lg leading-relaxed text-ink-2">
              全部演示文档均为合成演示数据(每篇标注 synthetic: true),覆盖制度、
              IT、产品、技术 SOP 等类型,仅用于产品演示与检索质量评测。
            </p>
            <p className="mt-3 text-body-lg leading-relaxed text-ink-2">
              本项目不接入任何真实企业数据;上述声明适用于本项目的一切文档、页面与演示场合。
            </p>
          </div>
        </section>

        {/* 技术栈列表(2026-09-14 人规格):左侧浅灰分类徽标 + 正文体系(非 mono),
            行内边距 py-3 + 行间 hairline 分割线;版本与模型名来自仓库实况 */}
        <section aria-labelledby="tech-stack">
          <SectionTitle id="tech-stack">技术栈</SectionTitle>
          <dl className="mt-2 divide-y divide-hairline border-y border-hairline">
            {TECH_STACK.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-4 py-3">
                <dt className="w-12 shrink-0">
                  <Badge className="w-12 justify-center">{label}</Badge>
                </dt>
                <dd className="text-body-sm leading-relaxed text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 边界说明(2026-09-14 人规格):中性灰圆点列表 + 统一间距,文字不变;
            不做清单摘要(PRD「明确不做清单」,合并同类项) */}
        <section aria-labelledby="boundary">
          <SectionTitle id="boundary">产品边界</SectionTitle>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-body-md text-ink-2 marker:text-ink-3">
            {BOUNDARIES.map(({ item, reason }) => (
              <li key={item}>
                <span className="text-ink">{item}</span>: {reason}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
