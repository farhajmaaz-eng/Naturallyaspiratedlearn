import { authenticated } from "@/lib/auth";
import { MAX_JSON_BODY_BYTES } from "@/lib/limits";
import { allFolders, createFolder } from "@/lib/notes";
import { readJson, sameOrigin } from "@/lib/validation";
import { validTitle } from "@/lib/validators";

export const runtime = "nodejs";

export function GET(request: Request) {
  if (!authenticated(request)) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  return Response.json({ folders: allFolders() }, { headers: { "Cache-Control": "no-store" } });
}

export function POST(request: Request) {
  return guarded(request, async () => {
    let body: unknown;
    try {
      body = await readJson(request.body, MAX_JSON_BODY_BYTES);
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }
    const record = (body ?? {}) as Record<string, unknown>;
    if (!("name" in record)) return Response.json({ error: "Folder name is required." }, { status: 400 });
    const name = validTitle(record.name, 80);
    if (!name) return Response.json({ error: "Folder name must be 1-80 characters." }, { status: 400 });
    const folder = createFolder(crypto.randomUUID(), name);
    return Response.json({ folder }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}

function guarded(request: Request, handler: () => Promise<Response>): Promise<Response> {
  if (!sameOrigin(request)) return Promise.resolve(Response.json({ error: "Request origin is not allowed." }, { status: 403 }));
  if (!authenticated(request)) return Promise.resolve(Response.json({ error: "Sign in to continue." }, { status: 401 }));
  return handler();
}
