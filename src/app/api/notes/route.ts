import { authenticated } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import { clampSource, extractSource, SourceError } from "@/lib/source";
import { newId } from "@/lib/db";
import { allFolders, allNotes, folderExists, saveNote } from "@/lib/notes";
import { notesSystemPrompt, userPrompt } from "@/lib/prompts";
import { chat, resolveKey, resolveModel, UpstreamError } from "@/lib/openrouter";
import { getAiLimiter, RateLimitError } from "@/lib/limiter";
import { sameOrigin, sanitized, tooLarge } from "@/lib/validation";
import { validTitle } from "@/lib/validators";

export const runtime = "nodejs";

export function GET(request: Request) {
  if (!authenticated(request)) return json({ error: "Sign in to continue." }, 401);
  return json({ notes: allNotes(), folders: allFolders() }, 200);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  if (!authenticated(request)) return json({ error: "Sign in to continue." }, 401);
  if (tooLarge(request.headers.get("content-length"), MAX_UPLOAD_BYTES + 64 * 1024)) {
    return json({ error: "Upload is too large. The limit is 10MB." }, 413);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) return json({ error: "Expected a multipart upload." }, 415);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The upload could not be read. Check the file and try again." }, 400);
  }
  const file = form.get("file");
  const text = form.get("text");
  let sourceText: string;
  let sourceTitle: string;
  try {
    if (file instanceof File) {
      if (file.size > MAX_UPLOAD_BYTES) return json({ error: "Upload is too large. The limit is 10MB." }, 413);
      const parsed = await extractSource(file);
      sourceText = parsed.text;
      sourceTitle = parsed.title;
    } else if (typeof text === "string" && text.trim()) {
      sourceText = text;
      sourceTitle = validTitle(form.get("title"), 200) ?? `${text.trim().slice(0, 60)}…`;
    } else {
      return json({ error: "Provide a file or text to create a note." }, 400);
    }
    if (!sourceText.trim()) return json({ error: "The provided source is empty." }, 400);
    if (sourceText.length > 100_000) sourceText = clampSource(sourceText);
  } catch (error) {
    if (error instanceof SourceError) return json({ error: error.message }, 400);
    return json({ error: "The source could not be read. Try a different file." }, 400);
  }

  let key: string;
  let model: string;
  try {
    const resolved = resolveKey(request);
    if (!resolved) return json({ error: "No OpenRouter key available. Provide x-openrouter-key or set OPENROUTER_API_KEY." }, 400);
    key = resolved;
    model = resolveModel(request, Object.fromEntries([...form.entries()].filter(([k]) => k === "model").map(([k, v]) => [k, typeof v === "string" ? v : ""])));
  } catch (error) {
    if (error instanceof UpstreamError) return json({ error: error.message }, error.status);
    return json({ error: sanitized(error) }, 500);
  }

  const release = await acquireSlot(request);
  if (release instanceof Response) return release;

  try {
    const content = await chat(key, model, [
      { role: "system", content: notesSystemPrompt() },
      { role: "user", content: userPrompt("Create thorough, well-structured study notes in Markdown from the source below.", sourceText) },
    ], { temperature: 0.3, maxTokens: 8192 });
    const title = validTitle(form.get("title"), 200) ?? sourceTitle;
    const now = new Date().toISOString();
    const requestedFolder = typeof form.get("folderId") === "string" ? String(form.get("folderId")) : "";
    const note = {
      id: newId(),
      title,
      folderId: requestedFolder && folderExists(requestedFolder) ? requestedFolder : null,
      source: sourceText,
      content,
      createdAt: now,
      updatedAt: now,
      flashcards: [],
      quiz: [],
      podcast: "",
      messages: [],
    };
    saveNote(note);
    return json({ note }, 200);
  } catch (error) {
    if (error instanceof UpstreamError) return json({ error: error.message }, error.status);
    return json({ error: sanitized(error) }, 500);
  } finally {
    release();
  }
}

function json(data: unknown, status: number) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function acquireSlot(request: Request): Promise<(() => void) | Response> {
  try {
    return await getAiLimiter().acquire();
  } catch (error) {
    if (error instanceof RateLimitError) return json({ error: error.message }, 429);
    void request;
    return json({ error: sanitized(error) }, 500);
  }
}
