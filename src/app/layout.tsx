import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KnowFlow AI",
  description: "企业 AI 知识助手 — 更快、更准确、更可信地获取内部知识",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
