"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DocFormatBadge, DocStatusBadge } from "@/components/documents/doc-status-badge";
import { IconFiles } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { chunkFallbackTitle, chunkHeading, chunkSummary } from "@/lib/chunk-format";
import { formatUploadDate } from "@/lib/format";
import { ApiError, getDocument } from "@/lib/rag";
import type { DocumentDetail } from "@/lib/rag";

/* 文档详情页(2026-09-13 闭环优化,规格 4.1/4.2/4.3):
   基本信息(名称/格式/上传时间/状态+失败原因/Chunk 数)+ 内容预览(前 2000 字)
   + Chunk 列表(Chunk ID/标题·章节/文本摘要,不暴露 embedding 等底层技术字段)。
   来源抽屉「在文档库中查看」与文档列表标题均定位到此页(Citation → Chunk → 原文链路);
   数据全部来自后端落库结果(GET /api/documents/:id),同步链路不伪异步;
   404 = 文档不存在或已被删除。 */

const NOT_FOUND_MESSAGE = "文档不存在或已被删除";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    try {
      setDoc(await getDocument(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
        setDoc(null);
      } else {
        // 非 ApiError(如网络失败)不暴露技术细节,统一可读文案(规格:不露 JSON/Stack)
        setError(
          err instanceof ApiError ? err.message : "文档详情加载失败,请稍后重试",
        );
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-hairline bg-surface px-6 py-16 text-center">
        <IconFiles className="size-8 text-ink-3" />
        <p className="text-body-md text-ink">{NOT_FOUND_MESSAGE}</p>
        <Link href="/documents">
          <Button variant="secondary">返回文档库</Button>
        </Link>
      </div>
    );
  }

  if (doc === null) {
    return (
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1 text-body-sm text-ink-2 transition-colors duration-150 hover:text-brand-600"
        >
          ← 返回文档库
        </Link>
        {error ? (
          <div className="mt-6 flex flex-col items-start gap-3">
            <p role="alert" className="text-body-sm text-danger-text">
              {error}
            </p>
            <Button variant="secondary" onClick={() => void load()}>
              重试
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-3" aria-label="加载中">
            <div className="h-8 w-64 animate-skeleton rounded-md bg-surface-2" />
            <div className="h-24 animate-skeleton rounded-md bg-surface-2" />
            <div className="h-40 animate-skeleton rounded-md bg-surface-2" />
          </div>
        )}
      </div>
    );
  }

  const uploadedAt = formatUploadDate(doc.uploaded_at);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/documents"
        className="inline-flex w-fit items-center gap-1 text-body-sm text-ink-2 transition-colors duration-150 hover:text-brand-600"
      >
        ← 返回文档库
      </Link>

      <PageHeader title={doc.title} />

      <section
        aria-label="基本信息"
        className="rounded-md border border-hairline bg-surface px-4 py-3"
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-caption text-ink-3">文件格式</dt>
            <dd className="mt-1">
              <DocFormatBadge fileType={doc.file_type} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-3">状态</dt>
            <dd className="mt-1">
              <DocStatusBadge status={doc.status} lastError={doc.last_error} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-3">上传时间</dt>
            <dd className="mt-1 text-body-sm text-ink">{uploadedAt || "—"}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-3">分块数</dt>
            <dd className="mt-1 text-body-sm text-numeric">{doc.chunk_count}</dd>
          </div>
        </dl>
        {doc.last_error ? (
          <p
            role="alert"
            className="mt-3 border-t border-hairline pt-3 text-body-sm text-danger-text"
          >
            失败原因:{doc.last_error}
          </p>
        ) : null}
      </section>

      <section aria-label="内容预览" className="flex flex-col gap-2">
        <h2 className="text-heading-2 font-semibold text-ink">内容预览</h2>
        {doc.preview ? (
          <p className="max-h-[320px] overflow-y-auto whitespace-pre-line rounded-md border border-hairline bg-surface px-4 py-3 text-body-md text-ink">
            {doc.preview}
          </p>
        ) : (
          <p className="rounded-md border border-hairline bg-surface-2 px-4 py-3 text-body-sm text-ink-2">
            暂无预览(文档解析失败或源文件缺失)
          </p>
        )}
      </section>

      <section aria-label="分块内容" className="flex flex-col gap-2">
        <h2 className="text-heading-2 font-semibold text-ink">
          分块内容({doc.chunks.length})
        </h2>
        {doc.chunks.length === 0 ? (
          <p className="rounded-md border border-hairline bg-surface-2 px-4 py-3 text-body-sm text-ink-2">
            暂无分块(文档解析失败或尚未完成索引)
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {doc.chunks.map((chunk) => {
              const heading = chunkHeading(chunk.text);
              return (
                <li
                  key={chunk.id}
                  className="rounded-md border border-hairline bg-surface px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2 border-b border-hairline pb-2">
                    <span className="text-body-sm font-medium text-ink">
                      Chunk {chunk.order}
                    </span>
                    <span
                      className="truncate font-mono text-caption text-ink-3"
                      title={chunk.id}
                    >
                      {chunk.id}
                    </span>
                  </div>
                  <p className="mt-2 text-body-sm font-medium text-ink-2">
                    {heading ?? chunkFallbackTitle(chunk.text)}
                  </p>
                  <p className="mt-1 text-body-sm text-ink">{chunkSummary(chunk.text)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
