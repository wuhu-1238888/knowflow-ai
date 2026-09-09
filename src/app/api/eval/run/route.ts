import { proxyToRag } from "@/lib/rag";

/* POST /api/eval/run → FastAPI /api/eval/run(后端端点 3.3.4 交付,当前透传 404)。 */

export async function POST(request: Request) {
  return proxyToRag(request, "/api/eval/run", "POST");
}
