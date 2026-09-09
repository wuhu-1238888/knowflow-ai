import { proxyToRag } from "@/lib/rag";

/* POST /api/ask → FastAPI /api/ask(错误码透传,统一 {error} 错误态)。 */

export async function POST(request: Request) {
  return proxyToRag(request, "/api/ask", "POST");
}
