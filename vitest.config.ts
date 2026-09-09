import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig 的 jsx: "preserve" 是 Next.js 要求;测试侧用 plugin-react(Babel)转换 TSX
  plugins: [react()],
  // 与 Next dev server 的 Vite 缓存(node_modules/.vite)分离,避免并发读写损坏测试缓存
  // (实测:dev server 运行中反复出现 "Vitest failed to find the current suite")
  cacheDir: "node_modules/.vitest",
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
