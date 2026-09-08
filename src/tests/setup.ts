import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/* 未开 vitest globals,Testing Library 不会自动注册 afterEach → 显式 cleanup,
   避免 DOM 在用例间累积(重复元素/查询歧义)。 */
afterEach(() => {
  cleanup();
});
