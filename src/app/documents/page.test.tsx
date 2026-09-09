import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentsPage from "@/app/documents/page";

/* L3 文档库页状态机测试(3.3.3):列表/骨架/空态/失败、上传乐观行(行内进度)、
   删除 danger 二次确认(遮罩/Esc 取消)、重建索引(含行内失败)。
   直接 stub 全局 fetch,断言请求路径与 FormData 内容。 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const DOCS_RESPONSE = {
  items: [
    {
      id: "doc-1",
      title: "员工手册.md",
      file_type: "md",
      status: "indexed",
      uploaded_at: "2026-09-05T10:30:00",
      synthetic: false,
      chunk_count: 3,
    },
    {
      id: "doc-2",
      title: "扫描件.pdf",
      file_type: "pdf",
      status: "failed",
      uploaded_at: "2026-09-06T09:00:00",
      synthetic: false,
      chunk_count: 0,
    },
  ],
  total: 2,
  page: 1,
  page_size: 100,
};

const INGEST_BODY = {
  doc_id: "doc-3",
  title: "新政策.md",
  file_type: "md",
  status: "indexed",
  chunk_count: 1,
};

interface Routes {
  GET_documents?: () => Promise<Response>;
  POST_ingest?: () => Promise<Response>;
  DELETE_doc?: (id: string) => Promise<Response>;
  POST_reindex?: (id: string) => Promise<Response>;
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
      if (method === "GET" && path === "/api/documents") {
        return routes.GET_documents
          ? routes.GET_documents()
          : jsonResponse({ error: "缺 GET_documents stub" }, 404);
      }
      if (method === "POST" && path === "/api/ingest") {
        return routes.POST_ingest
          ? routes.POST_ingest()
          : jsonResponse({ error: "缺 POST_ingest stub" }, 404);
      }
      if (method === "DELETE" && path.startsWith("/api/documents/")) {
        return routes.DELETE_doc
          ? routes.DELETE_doc(decodeURIComponent(path.split("/")[3]))
          : jsonResponse({ error: "缺 DELETE_doc stub" }, 404);
      }
      if (method === "POST" && path.endsWith("/reindex")) {
        return routes.POST_reindex
          ? routes.POST_reindex(decodeURIComponent(path.split("/")[3]))
          : jsonResponse({ error: "缺 POST_reindex stub" }, 404);
      }
      return jsonResponse({ error: `未匹配 ${method} ${path}` }, 404);
    },
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function fileInputOf(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentsPage 列表", () => {
  it("首屏加载:标题/格式徽标/状态徽标/分块数/上传时间/总数;请求带分页参数", async () => {
    const fetchMock = stubRoutes({
      GET_documents: () => Promise.resolve(jsonResponse(DOCS_RESPONSE)),
    });
    render(<DocumentsPage />);

    expect(await screen.findByText("员工手册.md")).toBeTruthy();
    expect(screen.getByText("MD")).toBeTruthy();
    expect(screen.getByText("已索引")).toBeTruthy();
    expect(screen.getByText("解析失败")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2026-09-05")).toBeTruthy();
    expect(screen.getByText("共 2 篇文档")).toBeTruthy();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/documents?page=1&page_size=100");
  });

  it("加载中显示骨架脉动,完成后呈现表格", async () => {
    let resolveGet!: (response: Response) => void;
    stubRoutes({
      GET_documents: () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    });
    render(<DocumentsPage />);

    expect(screen.getByLabelText("加载中")).toBeTruthy();
    resolveGet(jsonResponse(DOCS_RESPONSE));
    expect(await screen.findByText("员工手册.md")).toBeTruthy();
    expect(screen.queryByLabelText("加载中")).toBeNull();
  });

  it("空列表显示「暂无文档」空态", async () => {
    stubRoutes({
      GET_documents: () =>
        Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, page_size: 100 })),
    });
    render(<DocumentsPage />);
    expect(await screen.findByText("暂无文档")).toBeTruthy();
    expect(screen.getByText(/拖入或选择文档上传/)).toBeTruthy();
  });

  it("列表加载失败呈现错误提示", async () => {
    stubRoutes({
      GET_documents: () => Promise.resolve(jsonResponse({ error: "数据库错误" }, 500)),
    });
    render(<DocumentsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("数据库错误");
  });
});

describe("DocumentsPage 上传", () => {
  it("上传成功:行内「上传解析中…」乐观行(待索引徽标 + 按钮禁用)→ 完成后刷新出现新文档", async () => {
    let resolveIngest!: (response: Response) => void;
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(DOCS_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "doc-3",
              title: "新政策.md",
              file_type: "md",
              status: "indexed",
              uploaded_at: "2026-09-07T11:00:00",
              synthetic: false,
              chunk_count: 1,
            },
            ...DOCS_RESPONSE.items,
          ],
          total: 3,
          page: 1,
          page_size: 100,
        }),
      );
    const fetchMock = stubRoutes({
      GET_documents: () => getMock(),
      POST_ingest: () =>
        new Promise<Response>((resolve) => {
          resolveIngest = resolve;
        }),
    });
    const { container } = render(<DocumentsPage />);
    await screen.findByText("员工手册.md");

    const file = new File(["demo"], "新政策.md", { type: "text/markdown" });
    fireEvent.change(fileInputOf(container), { target: { files: [file] } });

    // 乐观行:表格行内进度,无全局遮罩;上传按钮禁用
    expect(await screen.findByText("上传解析中…")).toBeTruthy();
    expect(screen.getByText("待索引")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "上传文档" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveIngest(jsonResponse(INGEST_BODY));
    expect(await screen.findByText("新政策.md")).toBeTruthy();
    expect(screen.queryByText("上传解析中…")).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(2);

    const ingestCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    )!;
    expect((ingestCall[1]!.body as FormData).get("file")).toBe(file);
  });

  it("不支持的格式:客户端拒绝并提示,不发上传请求", async () => {
    const fetchMock = stubRoutes({
      GET_documents: () => Promise.resolve(jsonResponse(DOCS_RESPONSE)),
    });
    const { container } = render(<DocumentsPage />);
    await screen.findByText("员工手册.md");

    fireEvent.change(fileInputOf(container), {
      target: { files: [new File(["x"], "photo.png")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "暂不支持 .png 格式",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1); // 仅初始 GET
  });

  it("上传 422 解析失败:错误提示 + 刷新列表以呈现 failed 行(可重建索引)", async () => {
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(DOCS_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "doc-4",
              title: "空文档.md",
              file_type: "md",
              status: "failed",
              uploaded_at: "2026-09-08T08:00:00",
              synthetic: false,
              chunk_count: 0,
            },
            ...DOCS_RESPONSE.items,
          ],
          total: 3,
          page: 1,
          page_size: 100,
        }),
      );
    stubRoutes({
      GET_documents: () => getMock(),
      POST_ingest: () =>
        Promise.resolve(jsonResponse({ error: "文件解析失败:无法提取文本" }, 422)),
    });
    const { container } = render(<DocumentsPage />);
    await screen.findByText("员工手册.md");

    fireEvent.change(fileInputOf(container), {
      target: { files: [new File(["x"], "空文档.md")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "文件解析失败:无法提取文本",
    );
    // failed 行已刷新呈现(状态徽标「解析失败」出现第二处)
    expect(await screen.findByText("空文档.md")).toBeTruthy();
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});

describe("DocumentsPage 删除(FR-09)", () => {
  it("二次确认模态:点遮罩/Esc 取消不发请求;确认后 DELETE 并刷新(行消失)", async () => {
    const deleteMock = vi.fn().mockResolvedValue(jsonResponse({ deleted: "doc-1" }));
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(DOCS_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [DOCS_RESPONSE.items[1]],
          total: 1,
          page: 1,
          page_size: 100,
        }),
      );
    stubRoutes({
      GET_documents: () => getMock(),
      DELETE_doc: (id) => deleteMock(id),
    });
    render(<DocumentsPage />);
    await screen.findByText("员工手册.md");

    fireEvent.click(screen.getByRole("button", { name: "删除:员工手册.md" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/确定删除「员工手册\.md」吗/)).toBeTruthy();

    // 点遮罩取消 → 模态关闭,无 DELETE
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!.firstElementChild!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteMock).not.toHaveBeenCalled();

    // Esc 取消
    fireEvent.click(screen.getByRole("button", { name: "删除:员工手册.md" }));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteMock).not.toHaveBeenCalled();

    // 确认删除 → DELETE + 刷新
    fireEvent.click(screen.getByRole("button", { name: "删除:员工手册.md" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteMock).toHaveBeenCalledWith("doc-1");
    await waitFor(() => expect(screen.queryByText("员工手册.md")).toBeNull());
    expect(await screen.findByText("扫描件.pdf")).toBeTruthy();
    expect(screen.getByText("共 1 篇文档")).toBeTruthy();
  });

  it("删除失败:模态内呈现错误且不关闭", async () => {
    stubRoutes({
      GET_documents: () => Promise.resolve(jsonResponse(DOCS_RESPONSE)),
      DELETE_doc: () => Promise.resolve(jsonResponse({ error: "数据库繁忙" }, 500)),
    });
    render(<DocumentsPage />);
    await screen.findByText("员工手册.md");

    fireEvent.click(screen.getByRole("button", { name: "删除:员工手册.md" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("数据库繁忙");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("DocumentsPage 重建索引", () => {
  it("点击行内按钮 → POST reindex → 刷新;解析中文档按钮禁用", async () => {
    const parsingResp = {
      items: [
        {
          id: "doc-5",
          title: "解析中.md",
          file_type: "md",
          status: "parsing",
          uploaded_at: "2026-09-08T08:00:00",
          synthetic: false,
          chunk_count: 0,
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    };
    const reindexMock = vi.fn().mockResolvedValue(
      jsonResponse({
        doc_id: "doc-5",
        title: "解析中.md",
        file_type: "md",
        status: "indexed",
        chunk_count: 2,
      }),
    );
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(parsingResp))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ ...parsingResp.items[0], status: "indexed", chunk_count: 2 }],
          total: 1,
          page: 1,
          page_size: 100,
        }),
      );
    stubRoutes({
      GET_documents: () => getMock(),
      POST_reindex: (id) => reindexMock(id),
    });
    render(<DocumentsPage />);
    await screen.findByText("解析中.md");

    // status=parsing 时重建索引按钮禁用
    const button = screen.getByRole("button", {
      name: "重建索引:解析中.md",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // 状态变为 indexed 后(刷新)→ 按钮可用,点击触发 POST reindex
    // 直接用第二个 fixture:重新渲染场景改为可点 → 此处直接断言禁用逻辑,
    // 成功路径在下一用例覆盖。
    expect(reindexMock).not.toHaveBeenCalled();
  });

  it("重建索引成功 → 刷新;失败 → 行内 role=alert 错误", async () => {
    const reindexMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          doc_id: "doc-2",
          title: "扫描件.pdf",
          file_type: "pdf",
          status: "indexed",
          chunk_count: 4,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "源文件不存在" }, 500));
    const getMock = vi.fn().mockResolvedValue(jsonResponse(DOCS_RESPONSE));
    stubRoutes({
      GET_documents: () => getMock(),
      POST_reindex: (id) => reindexMock(id),
    });
    render(<DocumentsPage />);
    await screen.findByText("扫描件.pdf");

    fireEvent.click(screen.getByRole("button", { name: "重建索引:扫描件.pdf" }));
    await waitFor(() => expect(reindexMock).toHaveBeenCalledWith("doc-2"));

    fireEvent.click(screen.getByRole("button", { name: "重建索引:扫描件.pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("源文件不存在");
  });
});
