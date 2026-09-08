import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@/styles/theme.css";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "KnowFlow AI",
  description: "KnowFlow AI——企业 AI 知识助手:带来源引用的准确回答,无答案时明确拒答。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
