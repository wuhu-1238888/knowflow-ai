"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmModal } from "@/components/documents/confirm-modal";
import { DocumentTable } from "@/components/documents/document-table";
import {
  UploadZone,
  isSupportedFormat,
} from "@/components/documents/upload-zone";
import { IconFiles, IconUpload } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  deleteDocument,
  listDocuments,
  reindexDocument,
  uploadDocument,
} from "@/lib/rag";
import type { DocumentInfo } from "@/lib/rag";
import { setNavSource } from "@/lib/nav-context";

/* 文档库页(DesignRules 文档库页):上传区 + 文档表格 + 删除 danger 二次确认 +
   重建索引。上传 = 表格内乐观行(待索引徽标),无全局遮罩;
   解析失败(422)后端已落 failed 行,刷新列表以呈现该行供重建索引。
   本页唯一 primary = 「上传文档」;「确认删除」在模态内(其上下文唯一 primary)。 */

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentInfo[] | null>(null);
  const [total, setTotal] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{
    name: string;
    format: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentInfo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [reindexing, setReindexing] = useState<string[]>([]);
  const [reindexErrors, setReindexErrors] = useState<Record<string, string>>({});
  /* 操作成功提示(2026-09-13 闭环优化):删除/重建索引不再是静默成功,3 秒自动消失 */
  const [notice, setNotice] = useState<{
    kind: "deleted" | "reindexed";
    title: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* 返回上下文(2026-09-13):挂载时标记来源,供文档详情页「返回文档库」判断 */
  useEffect(() => {
    setNavSource("docs");
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    setListError(null);
    try {
      const result = await listDocuments(1, 100);
      setDocs(result.items);
      setTotal(result.total);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "加载文档列表失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    if (!isSupportedFormat(file.name)) {
      // 不支持的文件不进上传/解析流程(2026-09-14 人规格:错误文案固定)
      setUploadError(
        "文件格式不支持,请选择 .md / .pdf / .docx / .html / .txt 文件",
      );
      return;
    }
    const format = file.name.split(".").pop()?.toLowerCase() ?? "";
    setUploading({ name: file.name, format });
    try {
      await uploadDocument(file);
      await load();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
      // 解析失败(422)时后端已落一条 failed 记录,刷新以呈现该行
      await load();
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteDocument(deleteTarget.id);
      setNotice({ kind: "deleted", title: deleteTarget.title });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletePending(false);
    }
  };

  const handleReindex = async (doc: DocumentInfo) => {
    setReindexing((prev) => [...prev, doc.id]);
    setReindexErrors((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    try {
      await reindexDocument(doc.id);
      setNotice({ kind: "reindexed", title: doc.title });
      await load();
    } catch (error) {
      setReindexErrors((prev) => ({
        ...prev,
        [doc.id]: error instanceof Error ? error.message : "重建索引失败",
      }));
    } finally {
      setReindexing((prev) => prev.filter((id) => id !== doc.id));
    }
  };

  return (
    <div>
      <PageHeader title="文档库">
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading !== null}
        >
          <IconUpload className="size-4" />
          上传文档
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.pdf,.docx,.html,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
            event.target.value = "";
          }}
        />
      </PageHeader>

      {notice ? (
        <p role="status" className="mt-4 text-body-sm text-success-text">
          {notice.kind === "deleted"
            ? `已删除「${notice.title}」,该文档不再参与检索`
            : `已重建索引:${notice.title}`}
        </p>
      ) : null}

      <div className="mt-6">
        <UploadZone
          onBrowse={() => inputRef.current?.click()}
          onFile={(file) => void handleFile(file)}
          disabled={uploading !== null}
          error={uploadError}
          uploadingName={uploading?.name ?? null}
        />
      </div>

      <div className="mt-8">
        {docs === null ? (
          listError ? (
            <div className="flex flex-col items-start gap-3">
              <p role="alert" className="text-body-sm text-danger-text">
                {listError}
              </p>
              {/* 2026-09-13 闭环优化:列表加载失败可原地重试(原为纯提示) */}
              <Button variant="secondary" onClick={() => void load()}>
                重试
              </Button>
            </div>
          ) : (
            <div className="space-y-2" aria-label="加载中">
              <div className="h-10 animate-skeleton rounded-md bg-surface-2" />
              <div className="h-10 animate-skeleton rounded-md bg-surface-2" />
              <div className="h-10 animate-skeleton rounded-md bg-surface-2" />
            </div>
          )
        ) : docs.length === 0 && uploading === null ? (
          <EmptyState
            icon={<IconFiles />}
            title="暂无文档"
            description="拖入或选择文档上传,支持 .md .pdf .docx .html .txt 格式。"
          />
        ) : (
          <>
            <DocumentTable
              docs={docs}
              uploading={uploading}
              reindexing={reindexing}
              reindexErrors={reindexErrors}
              onDelete={setDeleteTarget}
              onReindex={(doc) => void handleReindex(doc)}
            />
            <p className="mt-3 text-caption text-ink-3">共 {total} 篇文档</p>
          </>
        )}
      </div>

      {deleteTarget ? (
        <ConfirmModal
          title="删除文档"
          description={
            <>
              确定删除「{deleteTarget.title}」吗?删除后该文档将从知识库移除,检索不再命中,且不可恢复。
            </>
          }
          pending={deletePending}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            if (!deletePending) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
