import { proxyToRag } from "@/lib/rag";

/* POST /api/ingest → FastAPI /api/ingest(后端端点 3.3.3 交付,当前透传 404)。 */

export async function POST(request: Request) {
  return proxyToRag(request, "/api/ingest", "POST");
}
