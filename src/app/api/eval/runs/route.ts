import { proxyToRag } from "@/lib/rag";

/* GET /api/eval/runs → FastAPI /api/eval/runs(后端端点 3.3.4 交付,当前透传 404)。 */

export async function GET(request: Request) {
  return proxyToRag(request, "/api/eval/runs", "GET");
}
