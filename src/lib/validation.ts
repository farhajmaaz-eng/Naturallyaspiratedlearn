export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function tooLarge(contentLength: string | null, limit: number): boolean {
  if (!contentLength) return false;
  const size = Number(contentLength);
  return Number.isFinite(size) && size > limit;
}

export async function readJson(body: ReadableStream<Uint8Array> | null, limit: number): Promise<unknown> {
  if (!body) throw new Error("request body is empty");
  const reader = body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error(`request body exceeds limit of ${limit} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function sanitizeModel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[\w.-]{1,100}(\/[\w.:-]{1,100}){0,3}$/.test(value) ? value : null;
}

export function sanitized(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/TimeoutError|timed?\s?out|abort/i.test(message)) return "The AI request timed out. Please try again.";
  if (/rate|429/i.test(message)) return "The AI provider is rate limiting requests. Please try again shortly.";
  if (/(401|403|invalid api key|no auth|unauthorized)/i.test(message)) return "The AI provider rejected the credentials. Check your OpenRouter key.";
  if (/(402|credits|quota)/i.test(message)) return "The AI provider account is out of credits.";
  if (/(500|502|503|504|bad gateway|service unavailable)/i.test(message)) return "The AI provider is temporarily unavailable. Please try again.";
  return "Unexpected error processing the AI request. Please try again.";
}
