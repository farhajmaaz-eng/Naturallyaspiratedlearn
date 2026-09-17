import { authenticated } from "@/lib/auth";
import { MAX_JSON_BODY_BYTES } from "@/lib/limits";
import { deleteNoteRow, folderExists, touchNote } from "@/lib/notes";
import { sameOrigin } from "@/lib/validation";
import { validFlashcards, validTitle } from "@/lib/validators";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export function GET(request: Request, { params }: Params) {
  return guarded(request, params, async (id) => {
    const note = touchNote(id, {});
    if (!note) return Response.json({ error: "Note not found." }, { status: 404 });
    return Response.json({ note }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return guarded(request, params, async (id) => {
    const body = (await readBody(request)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 });
    const patch: Parameters<typeof touchNote>[1] = {};
    if ("title" in body) {
      const title = validTitle(body.title, 200);
      if (!title) return Response.json({ error: "Title must be 1-200 characters." }, { status: 400 });
      patch.title = title;
    }
    if ("content" in body) {
      if (typeof body.content !== "string" || body.content.length > 200_000) {
        return Response.json({ error: "Content is required and must be under 200,000 characters." }, { status: 400 });
      }
      patch.content = body.content;
    }
    if ("folderId" in body) {
      if (body.folderId !== null && typeof body.folderId !== "string") {
        return Response.json({ error: "folderId must be a string or null." }, { status: 400 });
      }
      if (body.folderId && !folderExists(body.folderId)) {
        return Response.json({ error: "That folder no longer exists." }, { status: 400 });
      }
      patch.folderId = body.folderId;
    }
    if ("flashcards" in body) {
      const cards = validFlashcards(body.flashcards, 100);
      if (!cards) return Response.json({ error: "Flashcards are invalid or exceed the allowed size." }, { status: 400 });
      patch.flashcards = cards;
    }
    const note = touchNote(id, patch);
    if (!note) return Response.json({ error: "Note not found." }, { status: 404 });
    return Response.json({ note }, { headers: { "Cache-Control": "no-store" } });
  });
}

export function DELETE(request: Request, { params }: Params) {
  return guarded(request, params, async (id) => {
    if (!deleteNoteRow(id)) return Response.json({ error: "Note not found." }, { status: 404 });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  });
}

async function readBody(request: Request): Promise<unknown> {
  const { readJson } = await import("@/lib/validation");
  try {
    return await readJson(request.body, MAX_JSON_BODY_BYTES);
  } catch {
    return null;
  }
}

function guarded(request: Request, params: Params["params"], handler: (id: string) => Promise<Response>): Promise<Response> {
  if (!sameOrigin(request)) return Promise.resolve(Response.json({ error: "Request origin is not allowed." }, { status: 403 }));
  if (!authenticated(request)) return Promise.resolve(Response.json({ error: "Sign in to continue." }, { status: 401 }));
  return params.then(({ id }) => handler(id));
}
