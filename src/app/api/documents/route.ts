import { proxyToRag } from "@/lib/rag";

/* GET /api/documents → FastAPI /api/documents(后端端点 3.3.3 交付,当前透传 404)。 */

export async function GET(request: Request) {
  return proxyToRag(request, "/api/documents", "GET");
}
