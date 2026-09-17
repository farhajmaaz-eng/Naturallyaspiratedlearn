import { authenticated } from "@/lib/auth";
import { getAiLimiter, RateLimitError } from "@/lib/limiter";
import { MAX_JSON_BODY_BYTES } from "@/lib/limits";
import { getNoteRow, noteFromRow, touchNote } from "@/lib/notes";
import { chat, parseJsonObject, resolveKey, resolveModel, UpstreamError } from "@/lib/openrouter";
import { artifactSystemPrompt, sourceBlock } from "@/lib/prompts";
import { readJson, sameOrigin, sanitized } from "@/lib/validation";
import { validCount, validDifficulty, validFlashcards, validQuiz } from "@/lib/validators";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };
type Artifact = "flashcards" | "quiz" | "podcast";

export async function POST(request: Request, { params }: Params) {
  if (!sameOrigin(request)) return fail("Request origin is not allowed.", 403);
  if (!authenticated(request)) return fail("Sign in to continue.", 401);
  const { id } = await params;
  const row = getNoteRow(id);
  if (!row) return fail("Note not found.", 404);
  const note = noteFromRow(row);

  let body: Record<string, unknown>;
  try {
    body = (await readJson(request.body, MAX_JSON_BODY_BYTES)) as Record<string, unknown>;
  } catch {
    return fail("Invalid request body.", 400);
  }
  const kind = body.kind;
  if (kind !== "flashcards" && kind !== "quiz" && kind !== "podcast") return fail("Choose flashcards, quiz, or podcast.", 400);
  if (!validDifficulty(body.difficulty)) return fail("Difficulty must be easy, medium, or hard.", 400);
  const count = validCount(body.count, kind === "flashcards" ? 40 : 20) ?? (kind === "flashcards" ? 12 : 8);

  let key: string;
  let model: string;
  try {
    const resolved = resolveKey(request);
    if (!resolved) return fail("Add an OpenRouter API key in Settings to use AI tools.", 400);
    key = resolved;
    model = resolveModel(request, body);
  } catch (error) {
    return error instanceof UpstreamError ? fail(error.message, error.status) : fail(sanitized(error), 500);
  }

  let release: (() => void) | null = null;
  try {
    release = await getAiLimiter().acquire();
    const content = await chat(
      key,
      model,
      [
        { role: "system", content: artifactSystemPrompt(kind as Artifact) },
        {
          role: "user",
          content: requestPrompt(kind as Artifact, count, typeof body.difficulty === "string" ? body.difficulty : "medium", note.source),
        },
      ],
      { temperature: kind === "podcast" ? 0.65 : 0.25, maxTokens: kind === "podcast" ? 6000 : 5000 }
    );

    if (kind === "flashcards") {
      const data = parseJsonObject<{ cards?: unknown }>(content);
      const now = new Date().toISOString();
      const cards = validFlashcards(
        Array.isArray(data.cards)
          ? data.cards.map((card) => ({
              ...(card as Record<string, unknown>),
              id: crypto.randomUUID(),
              dueAt: now,
              interval: 0,
            }))
          : null,
        40
      );
      if (!cards?.length) return fail("The AI response did not contain usable flashcards. Please try again.", 502);
      return ok(touchNote(id, { flashcards: cards }));
    }

    if (kind === "quiz") {
      const data = parseJsonObject<{ questions?: unknown }>(content);
      const quiz = validQuiz(data.questions, 20);
      if (!quiz?.length) return fail("The AI response did not contain a usable quiz. Please try again.", 502);
      return ok(touchNote(id, { quiz }));
    }

    if (content.length > 100_000) return fail("The generated audio script was too long.", 502);
    return ok(touchNote(id, { podcast: content }));
  } catch (error) {
    if (error instanceof RateLimitError) return fail(error.message, 429);
    if (error instanceof UpstreamError) return fail(error.message, error.status);
    return fail(sanitized(error), 500);
  } finally {
    release?.();
  }
}

function requestPrompt(kind: Artifact, count: number, difficulty: string, source: string) {
  if (kind === "flashcards") return `Create ${count} ${difficulty} flashcards. Cover the most important ideas without repeating prompts.\n\n${sourceBlock(source)}`;
  if (kind === "quiz") return `Create ${count} ${difficulty} multiple-choice questions. Test understanding, not trivia.\n\n${sourceBlock(source)}`;
  return `Create an engaging 6-8 minute review conversation. Explain the important ideas in a calm, precise voice.\n\n${sourceBlock(source)}`;
}

function ok(note: unknown) {
  return Response.json({ note }, { headers: { "Cache-Control": "no-store" } });
}

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
