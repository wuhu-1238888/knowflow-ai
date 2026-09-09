import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EvalPage from "@/app/eval/page";

/* L3 评测页测试(3.3.4 全量):动态数据源(矩阵来自 /api/eval/runs)、
   运行评测(POST + 运行中禁用/骨架/5 秒轮询)、RunList 展开逐例明细、
   历史 CLI 批次降级(仅总指标 + 诚实说明)、空态/错误态/选型叙事。
   全部通过 stub 全局 fetch,数字只来自 stub 的 run 结果,不虚构。 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CREATED_AT = "2026-09-10T08:00:00+00:00";

function batchItem(mode: string, mrr: number) {
  return {
    run_id: `run-${mode}-1`,
    mode,
    params_hash: "abc123def4567890",
    doc_commit: "abc1234",
    created_at: CREATED_AT,
    status: "completed",
    metrics: { hit_at_5: { hits: 12, total: 12 }, mrr },
    has_per_case: true,
  };
}

const BATCH_ITEMS = [
  batchItem("vector", 0.9583),
  batchItem("hybrid", 0.9028),
  batchItem("hybrid_rerank", 0.9583),
];

const RUNNING_ITEMS = BATCH_ITEMS.map((item) => ({
  ...item,
  run_id: item.run_id.replace("run-", "run-active-"),
  status: "running",
  metrics: {},
  has_per_case: false,
}));

const PER_CASE = [
  {
    case_id: "C01",
    category: "假期制度",
    query: "年假有几天?",
    expected_behavior: "answer",
    expected_doc_ids: ["doc-hr-05"],
    in_metrics: true,
    hits: [],
    rank_of_first_expected: 1,
    hit: true,
    rr: 1.0,
    skipped: false,
    error: null,
  },
  {
    case_id: "C02",
    category: "报销流程",
    query: "差旅报销怎么走?",
    expected_behavior: "answer",
    expected_doc_ids: ["doc-fin-01"],
    in_metrics: true,
    hits: [],
    rank_of_first_expected: null,
    hit: false,
    rr: 0.0,
    skipped: false,
    error: null,
  },
  {
    case_id: "C03",
    category: "外部知识",
    query: "竞品的最新功能是什么?",
    expected_behavior: "refuse",
    expected_doc_ids: [],
    in_metrics: false,
    hits: [],
    rank_of_first_expected: null,
    hit: null,
    rr: null,
    skipped: false,
    error: null,
  },
];

function detailOf(id: string) {
  const summary = BATCH_ITEMS.find((item) => item.run_id === id) ?? BATCH_ITEMS[0];
  return { ...summary, per_case: PER_CASE };
}

interface Routes {
  GET_runs?: () => Promise<Response>;
  GET_run?: (id: string) => Promise<Response>;
  POST_run?: () => Promise<Response>;
}

function stubRoutes(routes: Routes) {
  const mock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = init?.method ?? "GET";
      const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      if (method === "GET" && path === "/api/eval/runs") {
        return routes.GET_runs
          ? routes.GET_runs()
          : jsonResponse({ error: "缺 GET_runs stub" }, 404);
      }
      if (method === "POST" && path === "/api/eval/run") {
        return routes.POST_run
          ? routes.POST_run()
          : jsonResponse({ error: "缺 POST_run stub" }, 404);
      }
      if (method === "GET" && path.startsWith("/api/eval/runs/")) {
        return routes.GET_run
          ? routes.GET_run(decodeURIComponent(path.split("/")[4]))
          : jsonResponse({ error: "缺 GET_run stub" }, 404);
      }
      return jsonResponse({ error: `未匹配 ${method} ${path}` }, 404);
    },
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers(); // 防假定时器泄漏污染后续测试的 waitFor/findBy
});

describe("EvalPage 加载与空态", () => {
  it("加载中显示骨架脉动,完成后呈现空态", async () => {
    let resolveGet!: (response: Response) => void;
    stubRoutes({
      GET_runs: () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    });
    render(<EvalPage />);

    expect(screen.getAllByLabelText("加载中").length).toBeGreaterThan(0);
    resolveGet(jsonResponse({ runs: [] }));
    expect(await screen.findByText("暂无评测数据")).toBeTruthy();
    expect(screen.queryByLabelText("加载中")).toBeNull();
  });

  it("列表加载失败:呈现错误与重试按钮,重试成功后呈现矩阵", async () => {
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "数据库错误" }, 500))
      .mockResolvedValueOnce(jsonResponse({ runs: BATCH_ITEMS }));
    stubRoutes({
      GET_runs: () => getMock(),
      GET_run: (id) => Promise.resolve(jsonResponse(detailOf(id))),
    });
    render(<EvalPage />);

    expect(await screen.findByText("数据库错误")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(
      await screen.findByRole("columnheader", { name: "假期制度" }),
    ).toBeTruthy();
  });
});

describe("EvalPage 评测矩阵(动态数据源)", () => {
  it("渲染最新完成批次:场景列来自逐例明细,默认行高亮,页脚可回溯", async () => {
    const detailCalls: string[] = [];
    stubRoutes({
      GET_runs: () => Promise.resolve(jsonResponse({ runs: BATCH_ITEMS })),
      GET_run: (id) => {
        detailCalls.push(id);
        return Promise.resolve(jsonResponse(detailOf(id)));
      },
    });
    render(<EvalPage />);

    const table = await screen.findByRole("table");
    // 场景列来自 per_case(in_metrics 的类别;refuse 例不进矩阵列)
    expect(await screen.findByRole("columnheader", { name: "假期制度" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "报销流程" })).toBeTruthy();
    expect(within(table).queryByRole("columnheader", { name: "外部知识" })).toBeNull();
    // 矩阵逐例明细 = 每行一次 detail 取数
    expect(detailCalls).toHaveLength(3);

    // 类别列取数:假期制度 1/1 × 3 模式、报销流程 0/1 × 3 模式
    expect(within(table).getAllByText("1/1")).toHaveLength(3);
    expect(within(table).getAllByText("0/1")).toHaveLength(3);
    // 总指标列(实测值)
    expect(within(table).getAllByText("12/12")).toHaveLength(3);
    expect(within(table).getAllByText("0.9583")).toHaveLength(2);
    expect(within(table).getByText("0.9028")).toBeTruthy();
    // 未纳入评测引擎的指标:3 模式 × 3 指标显式「暂无数据」
    expect(within(table).getAllByText("暂无数据")).toHaveLength(9);

    // 混合+重排默认行高亮 + 徽标
    const defaultRow = within(table).getByText(/混合\+重排/).closest("tr");
    expect(defaultRow?.textContent).toContain("当前默认");

    // 数据来源页脚可回溯(run_id + params_hash + doc_commit)
    expect(screen.getByText(/params_hash abc123def4567890/)).toBeTruthy();
    expect(screen.getByText(/doc_commit abc1234/)).toBeTruthy();
    expect(screen.getByText(/run run-vector-1/)).toBeTruthy();
  });

  it("历史 CLI 批次(无逐例明细):仅总指标列 + 诚实说明,不虚构场景列", async () => {
    stubRoutes({
      GET_runs: () =>
        Promise.resolve(
          jsonResponse({
            runs: BATCH_ITEMS.map((item) => ({ ...item, has_per_case: false })),
          }),
        ),
    });
    render(<EvalPage />);

    await screen.findByRole("table");
    expect(screen.getByText(/本批次未存逐例明细/)).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "假期制度" })).toBeNull();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("12/12")).toHaveLength(3);
    expect(within(table).getAllByText("暂无数据")).toHaveLength(9);
  });
});

describe("EvalPage 运行评测(FR-08 重跑)", () => {
  it("空列表点「运行评测」→ POST 202 → 刷新呈现运行中状态(按钮禁用 + 徽标)", async () => {
    const postMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          run_ids: ["run-active-vector-1", "run-active-hybrid-1", "run-active-hybrid_rerank-1"],
          created_at: CREATED_AT,
        },
        202,
      ),
    );
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ runs: RUNNING_ITEMS }));
    stubRoutes({ GET_runs: () => getMock(), POST_run: () => postMock() });
    render(<EvalPage />);

    expect(await screen.findByText("暂无评测数据")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "运行评测" }));
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));

    // 刷新后进入运行中:按钮禁用 + 骨架 + 三行「运行中」徽标
    expect(
      (
        screen.getByRole("button", { name: "评测运行中…" }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getAllByLabelText("加载中").length).toBeGreaterThan(0);
    expect(screen.getAllByText("运行中")).toHaveLength(3);
    expect(screen.getAllByText("计算中…")).toHaveLength(3);
  });

  it("启动遇 409(他处运行中):呈现可读错误,并刷新同步出运行中状态", async () => {
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ runs: RUNNING_ITEMS }));
    stubRoutes({
      GET_runs: () => getMock(),
      POST_run: () =>
        Promise.resolve(
          jsonResponse({ error: "已有评测正在运行,请等待完成" }, 409),
        ),
    });
    render(<EvalPage />);

    await screen.findByText("暂无评测数据");
    fireEvent.click(screen.getByRole("button", { name: "运行评测" }));
    expect(await screen.findByText("已有评测正在运行,请等待完成")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByText("运行中")).toHaveLength(3),
    );
  });
});

describe("EvalPage 运行历史与逐例明细", () => {
  it("点击行展开逐例明细(排名/命中/RR/跳过说明),再点收起;矩阵批次行不重复请求", async () => {
    const detailCalls: string[] = [];
    stubRoutes({
      GET_runs: () => Promise.resolve(jsonResponse({ runs: BATCH_ITEMS })),
      GET_run: (id) => {
        detailCalls.push(id);
        return Promise.resolve(jsonResponse(detailOf(id)));
      },
    });
    render(<EvalPage />);

    // 矩阵取数完成(3 行 × 1 次 detail)
    await screen.findByRole("columnheader", { name: "假期制度" });
    expect(detailCalls).toHaveLength(3);

    // 展开第一行(vector,明细已随矩阵取到 → 不新增请求)
    fireEvent.click(screen.getAllByRole("button", { name: /展开/ })[0]);
    expect(await screen.findByText("C01")).toBeTruthy();
    expect(screen.getByText("年假有几天?")).toBeTruthy();
    expect(screen.getAllByText("应作答")).toHaveLength(2);
    expect(screen.getByText("应拒答")).toBeTruthy();
    expect(screen.getByText("未命中")).toBeTruthy();
    expect(detailCalls).toHaveLength(3);

    // 收起
    fireEvent.click(screen.getByRole("button", { name: /收起/ }));
    await waitFor(() => expect(screen.queryByText("C01")).toBeNull());
  });

  it("历史 CLI 批次行(has_per_case=false)展开:诚实说明,不虚构明细", async () => {
    const cliRuns = BATCH_ITEMS.map((item) => ({ ...item, has_per_case: false }));
    stubRoutes({
      GET_runs: () => Promise.resolve(jsonResponse({ runs: cliRuns })),
      GET_run: (id) => {
        const summary = cliRuns.find((item) => item.run_id === id) ?? cliRuns[0];
        return Promise.resolve(jsonResponse(summary));
      },
    });
    render(<EvalPage />);

    await screen.findByRole("table");
    fireEvent.click(screen.getAllByRole("button", { name: /展开/ })[0]);
    expect(
      await screen.findByText(/未存逐例明细,仅展示总指标/),
    ).toBeTruthy();
  });

  it("明细加载失败:展开呈现可读错误", async () => {
    stubRoutes({
      GET_runs: () => Promise.resolve(jsonResponse({ runs: BATCH_ITEMS })),
      GET_run: () => Promise.resolve(jsonResponse({ error: "评测运行不存在" }, 404)),
    });
    render(<EvalPage />);

    await screen.findByRole("table");
    // 矩阵取数失败行 → 展开时重新拉取仍失败 → 行内错误
    fireEvent.click(screen.getAllByRole("button", { name: /展开/ })[0]);
    expect(await screen.findByText("评测运行不存在")).toBeTruthy();
  });
});

describe("EvalPage 选型叙事", () => {
  it("默认 Hybrid + Rerank,但不虚构提升幅度", async () => {
    stubRoutes({ GET_runs: () => Promise.resolve(jsonResponse({ runs: [] })) });
    render(<EvalPage />);

    expect(
      await screen.findByText("KnowFlow 当前默认使用 Hybrid + Rerank。"),
    ).toBeTruthy();
    expect(screen.getByText(/不预设「重排一定最好」/)).toBeTruthy();
    expect(screen.queryByText(/提升 \d+%/)).toBeNull();
  });
});

describe("EvalPage 轮询(假定时器,置于文件末尾防污染)", () => {
  it("运行中每 5 秒轮询,批次完成后自动呈现矩阵", async () => {
    // 假定时器下 waitFor/findBy 内部 setTimeout 被劫持会挂起 → 全部用
    // act + advanceTimersByTimeAsync 冲刷微任务后同步断言。
    vi.useFakeTimers();
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ runs: RUNNING_ITEMS }))
      .mockResolvedValue(jsonResponse({ runs: BATCH_ITEMS }));
    stubRoutes({
      GET_runs: () => getMock(),
      GET_run: (id) => Promise.resolve(jsonResponse(detailOf(id))),
    });
    render(<EvalPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // 运行中:按钮禁用 + 轮询说明,仅一次初始取数
    expect(
      (
        screen.getByRole("button", { name: "评测运行中…" }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/每 5 秒自动刷新状态/)).toBeTruthy();
    expect(getMock).toHaveBeenCalledTimes(1);

    // 5 秒轮询拿到完成批次 → 矩阵呈现,运行态消失
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("columnheader", { name: "假期制度" }),
    ).toBeTruthy();
    expect(screen.queryByText(/每 5 秒自动刷新状态/)).toBeNull();
    expect(screen.getByRole("button", { name: "运行评测" })).toBeTruthy();
  });
});
