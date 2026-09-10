import { proxyToRag } from "@/lib/rag";

/* POST /api/qa/:id/feedback → FastAPI /api/qa/:id/feedback(FR-12 有用/无用反馈);
   GET 同路径(3.4.6 状态恢复:刷新后读取该回答的已提交反馈)。 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(request, `/api/qa/${encodeURIComponent(id)}/feedback`, "POST");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(request, `/api/qa/${encodeURIComponent(id)}/feedback`, "GET");
}
