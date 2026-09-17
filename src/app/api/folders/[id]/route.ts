import { authenticated } from "@/lib/auth";
import { deleteFolderRow } from "@/lib/notes";
import { sameOrigin } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export function DELETE(request: Request, { params }: Params) {
  return guarded(request, params, (id) => {
    if (!deleteFolderRow(id)) return Response.json({ error: "Folder not found." }, { status: 404 });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  });
}

function guarded(request: Request, params: Params["params"], handler: (id: string) => Response): Promise<Response> {
  if (!sameOrigin(request)) return Promise.resolve(Response.json({ error: "Request origin is not allowed." }, { status: 403 }));
  if (!authenticated(request)) return Promise.resolve(Response.json({ error: "Sign in to continue." }, { status: 401 }));
  return params.then(({ id }) => handler(id));
}
