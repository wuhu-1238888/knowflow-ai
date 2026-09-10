"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmModal } from "@/components/documents/confirm-modal";
import { DocumentTable } from "@/components/documents/document-table";
import {
  SUPPORTED_FORMATS,
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
  const inputRef = useRef<HTMLInputElement>(null);

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
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase()
        : "";
      setUploadError(
        `暂不支持${ext ? ` .${ext} ` : "该"}格式,支持 ${SUPPORTED_FORMATS.join(" ")}`,
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

      <div className="mt-6">
        <UploadZone
          onBrowse={() => inputRef.current?.click()}
          onFile={(file) => void handleFile(file)}
          disabled={uploading !== null}
          error={uploadError}
        />
      </div>

      <div className="mt-8">
        {docs === null ? (
          listError ? (
            <p role="alert" className="text-body-sm text-danger-text">
              {listError}
            </p>
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
