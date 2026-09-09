import { IconRefresh, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DocFormatBadge, DocStatusBadge } from "@/components/documents/doc-status-badge";
import { formatUploadDate } from "@/lib/format";
import type { DocumentInfo } from "@/lib/rag";

/* 文档表格(DesignRules 文档库页):标题/格式/状态/分块数/上传时间/操作;
   table token 直用(table-container/header-cell/cell/row-hover);
   重建索引与删除均为 ghost icon 按钮(人显式触发,禁止自动);
   上传中 = 表格内乐观行(待索引徽标 + 解析中说明,无全局遮罩)。 */

export interface UploadingRow {
  name: string;
  format: string;
}

export interface DocumentTableProps {
  docs: DocumentInfo[];
  uploading: UploadingRow | null;
  reindexing: string[];
  reindexErrors: Record<string, string>;
  onDelete: (doc: DocumentInfo) => void;
  onReindex: (doc: DocumentInfo) => void;
}

const HEADER_CELL =
  "bg-surface-2 px-3 py-2.5 text-caption font-medium text-ink-2";
const BODY_CELL = "border-t border-hairline px-3 py-3 text-body-sm";

export function DocumentTable({
  docs,
  uploading,
  reindexing,
  reindexErrors,
  onDelete,
  onReindex,
}: DocumentTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className={HEADER_CELL}>文档标题</th>
              <th className={HEADER_CELL}>格式</th>
              <th className={HEADER_CELL}>状态</th>
              <th className={`${HEADER_CELL} text-right`}>分块数</th>
              <th className={HEADER_CELL}>上传时间</th>
              <th className={`${HEADER_CELL} text-right`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {uploading ? (
              <tr>
                <td className={`${BODY_CELL} border-t-0`}>
                  <span className="block truncate font-medium text-ink">
                    {uploading.name}
                  </span>
                  <span className="mt-0.5 block text-caption text-ink-3">
                    上传解析中…
                  </span>
                </td>
                <td className={`${BODY_CELL} border-t-0`}>
                  <DocFormatBadge fileType={uploading.format} />
                </td>
                <td className={`${BODY_CELL} border-t-0`}>
                  <DocStatusBadge status="pending" />
                </td>
                <td className={`${BODY_CELL} border-t-0 text-right text-ink-3`}>
                  —
                </td>
                <td className={`${BODY_CELL} border-t-0 text-ink-3`}>—</td>
                <td className={`${BODY_CELL} border-t-0`} />
              </tr>
            ) : null}
            {docs.map((doc) => {
              const reindexingNow = reindexing.includes(doc.id);
              const rowError = reindexErrors[doc.id] ?? "";
              return (
                <tr
                  key={doc.id}
                  className="transition-colors duration-150 hover:bg-surface-2"
                >
                  <td className={BODY_CELL}>
                    <span
                      className="block max-w-[320px] truncate font-medium text-ink"
                      title={doc.title}
                    >
                      {doc.title}
                    </span>
                    {rowError ? (
                      <span
                        role="alert"
                        className="mt-0.5 block text-caption text-danger-text"
                      >
                        {rowError}
                      </span>
                    ) : null}
                  </td>
                  <td className={BODY_CELL}>
                    <DocFormatBadge fileType={doc.file_type} />
                  </td>
                  <td className={BODY_CELL}>
                    <DocStatusBadge status={doc.status} />
                  </td>
                  <td className={`${BODY_CELL} text-right text-numeric`}>
                    {doc.chunk_count}
                  </td>
                  <td className={`${BODY_CELL} text-ink-2`}>
                    {formatUploadDate(doc.uploaded_at)}
                  </td>
                  <td className={BODY_CELL}>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="icon"
                        size="icon"
                        title="重建索引"
                        aria-label={`重建索引:${doc.title}`}
                        disabled={doc.status === "parsing" || reindexingNow}
                        onClick={() => onReindex(doc)}
                      >
                        <IconRefresh className="size-4" />
                      </Button>
                      <Button
                        variant="icon"
                        size="icon"
                        title="删除"
                        aria-label={`删除:${doc.title}`}
                        onClick={() => onDelete(doc)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
