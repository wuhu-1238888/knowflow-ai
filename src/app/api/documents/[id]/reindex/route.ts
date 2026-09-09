import { proxyToRag } from "@/lib/rag";

/* POST /api/documents/:id/reindex → FastAPI /api/documents/:id/reindex(任务 3.3.3)。 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(
    request,
    `/api/documents/${encodeURIComponent(id)}/reindex`,
    "POST",
  );
}
