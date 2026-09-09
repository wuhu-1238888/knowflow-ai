import { proxyToRag } from "@/lib/rag";

/* GET /api/eval/runs/:id → FastAPI /api/eval/runs/{run_id}(任务 3.3.4:逐例明细,RunList 展开用)。 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRag(request, `/api/eval/runs/${encodeURIComponent(id)}`, "GET");
}
