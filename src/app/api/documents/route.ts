import { proxyToRag } from "@/lib/rag";

/* GET /api/documents → FastAPI /api/documents(透传 ?page=&page_size= 分页参数)。 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyToRag(request, `/api/documents${url.search}`, "GET");
}
