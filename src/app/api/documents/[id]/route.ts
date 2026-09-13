import { proxyToRag } from "@/lib/rag";

/* DELETE + GET /api/documents/:id → FastAPI /api/documents/:id
   (后端端点 3.3.3 交付;GET 详情 = 2026-09-13 闭环优化)。 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(request, `/api/documents/${encodeURIComponent(id)}`, "DELETE");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(request, `/api/documents/${encodeURIComponent(id)}`, "GET");
}
