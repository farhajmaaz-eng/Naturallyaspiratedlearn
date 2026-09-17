import { authenticated, createSession, passwordMatches, sessionCookie } from "@/lib/auth";
import { sameOrigin } from "@/lib/validation";

export const runtime = "nodejs";

function reply(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}

export function GET(request: Request) {
  return reply({ authenticated: authenticated(request), configured: !!process.env.APP_PASSWORD, hasServerKey: !!process.env.OPENROUTER_API_KEY, defaultModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini" });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Request origin is not allowed." }, 403);
  const password = process.env.APP_PASSWORD;
  if (!password) return reply({ error: "Set APP_PASSWORD on the server and restart to enable sign-in." }, 503);
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Expected JSON." }, 415);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Password is required." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return reply({ error: "Request body is too large." }, 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body.password !== "string" || body.password.length > 1024) return reply({ error: "Enter a valid password." }, 400);
    if (!passwordMatches(body.password, password)) return reply({ error: "Incorrect password." }, 401);
    return reply({ authenticated: true }, 200, sessionCookie(createSession(password)));
  } catch {
    return reply({ error: "Invalid JSON request." }, 400);
  }
}

export function DELETE(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Request origin is not allowed." }, 403);
  return reply({ authenticated: false }, 200, sessionCookie(""));
}
