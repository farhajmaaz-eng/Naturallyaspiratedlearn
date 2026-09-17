import { authenticated } from "@/lib/auth";
import { getAiLimiter, RateLimitError } from "@/lib/limiter";
import { getNoteRow, noteFromRow, touchNote } from "@/lib/notes";
import { chat, resolveKey, resolveModel, UpstreamError, type ChatMessage } from "@/lib/openrouter";
import { chatSystemPrompt, historyMessages, sourceBlock } from "@/lib/prompts";
import { readJson, sameOrigin, sanitized } from "@/lib/validation";
import { MAX_MESSAGE_CHARS, MAX_MESSAGES } from "@/lib/limits";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  if (!sameOrigin(request)) return fail("Request origin is not allowed.", 403);
  if (!authenticated(request)) return fail("Sign in to continue.", 401);
  const { id } = await params;
  const row = getNoteRow(id);
  if (!row) return fail("Note not found.", 404);
  const note = noteFromRow(row);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(request.body, 64 * 1024)) as Record<string, unknown>;
  } catch {
    return fail("Invalid request body.", 400);
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) return fail("Message must be 1-8,000 characters.", 400);

  let key: string;
  let model: string;
  try {
    const resolved = resolveKey(request);
    if (!resolved) return fail("No OpenRouter key available. Provide x-openrouter-key or set OPENROUTER_API_KEY.", 400);
    key = resolved;
    model = resolveModel(request, body);
  } catch (error) {
    if (error instanceof UpstreamError) return fail(error.message, error.status);
    return fail(sanitized(error), 500);
  }

  let release: (() => void) | null = null;
  try {
    release = await getAiLimiter().acquire();
  } catch (error) {
    if (error instanceof RateLimitError) return fail(error.message, 429);
    return fail(sanitized(error), 500);
  }
  try {
    const history = historyMessages(note.messages as ChatMessage[], 12);
    const reply = await chat(key, model, [
      { role: "system", content: chatSystemPrompt() },
      ...history,
      { role: "user", content: `${message}\n\n${sourceBlock(note.source)}` },
    ], { temperature: 0.3, maxTokens: 1_200 });
    const messages = [...note.messages, { role: "user" as const, content: message }, { role: "assistant" as const, content: reply }].slice(-MAX_MESSAGES);
    const updated = touchNote(id, { messages });
    if (!updated) return fail("The note is no longer available.", 404);
    return Response.json({ note: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UpstreamError) return fail(error.message, error.status);
    return fail(sanitized(error), 500);
  } finally {
    release?.();
  }
}

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
