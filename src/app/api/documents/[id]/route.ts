import { proxyToRag } from "@/lib/rag";

/* DELETE /api/documents/:id → FastAPI /api/documents/:id(后端端点 3.3.3 交付)。 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(request, `/api/documents/${encodeURIComponent(id)}`, "DELETE");
}
