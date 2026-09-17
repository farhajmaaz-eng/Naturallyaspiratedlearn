export const UPSTREAM_URL = "https://openrouter.ai/api/v1/chat/completions";
export const UPSTREAM_TIMEOUT_MS = 90_000;
export const DEFAULT_MODEL = "openai/gpt-4o-mini";
const KEY_PATTERN = /^sk-or-[A-Za-z0-9_-]{16,256}$/;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function resolveKey(request: Request): string | null {
  const header = request.headers.get("x-openrouter-key");
  if (header !== null) {
    const key = header.trim();
    if (KEY_PATTERN.test(key)) return key;
    throw new UpstreamError(400, "The provided OpenRouter key looks invalid. It should start with sk-or-.");
  }
  const env = process.env.OPENROUTER_API_KEY;
  return env && env.trim() ? env.trim() : null;
}

export function resolveModel(request: Request, body: unknown): string {
  if (body && typeof body === "object" && "model" in (body as Record<string, unknown>)) {
    const raw = (body as Record<string, unknown>).model;
    if (typeof raw === "string" && raw.trim()) {
      const model = raw.trim();
      if (!/^[\w.-]{1,120}(\/[\w.:-]{1,120}){0,3}$/.test(model)) throw new UpstreamError(400, "The requested model name is not valid.");
      return model;
    }
  }
  const header = request.headers.get("x-openrouter-model");
  if (header && /^[\w.-]{1,120}(\/[\w.:-]{1,120}){0,3}$/.test(header.trim())) return header.trim();
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export async function chat(
  key: string,
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("upstream timeout")), UPSTREAM_TIMEOUT_MS);
  const onAbort = () => controller.abort(new Error("upstream timeout"));
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    let response: Response;
    try {
      response = await fetch(UPSTREAM_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "Naturallyaspiratedlearn",
        },
        body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.4, max_tokens: options.maxTokens ?? 4096, stream: false }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw new UpstreamError(504, "The AI request timed out. Please try again.");
      throw new UpstreamError(502, "Could not reach the AI provider. Check your network and try again.");
    }
    if (!response.ok) throw new UpstreamError(mapStatus(response.status), await reason(response));
    const payload = (await response.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new UpstreamError(502, "The AI provider returned an empty response. Please try again.");
    return content;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

async function reason(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) return "The AI provider rejected the credentials. Check your OpenRouter key.";
  if (response.status === 402) return "The AI provider account is out of credits.";
  if (response.status === 404) return "The selected AI model is not available.";
  if (response.status === 429) return "The AI provider is rate limiting requests. Please try again shortly.";
  if (response.status >= 500) return "The AI provider is temporarily unavailable. Please try again.";
  return "The AI provider rejected the request. Adjust your input and try again.";
}

function mapStatus(status: number): number {
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 429 ? 502 : status >= 500 ? 502 : 502;
}

export function parseJsonObject<T>(content: string): T {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new UpstreamError(502, "The AI provider returned an invalid structured response. Please try again.");
  }
}
