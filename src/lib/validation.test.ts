import assert from "node:assert/strict";
import { test } from "node:test";

const guards: typeof import("./validation") = await import(new URL("./validation.ts", import.meta.url).href);

test("origin checks and JSON parsing stay within size caps", async () => {
  const same = new Request("https://app.example/api/notes", { method: "POST", headers: { origin: "https://app.example" } });
  const cross = new Request("https://app.example/api/notes", { method: "POST", headers: { origin: "https://evil.example" } });
  const bare = new Request("https://app.example/api/notes", { method: "POST" });
  const proxied = new Request("http://0.0.0.0:3000/api/notes", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      "x-forwarded-host": "app.example",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(guards.sameOrigin(same), true);
  assert.equal(guards.sameOrigin(cross), false);
  assert.equal(guards.sameOrigin(bare), true);
  assert.equal(guards.sameOrigin(proxied), true);
  const once = new Request("https://app.example", { method: "POST", body: JSON.stringify({ a: 1 }), headers: { "content-type": "application/json" } }).body!;
  const parsed = await guards.readJson(once, 1024);
  assert.deepEqual(parsed, { a: 1 });
  const oversized = new Request("https://app.example", { method: "POST", body: JSON.stringify({ a: "x".repeat(2048) }), headers: { "content-type": "application/json" } }).body!;
  await assert.rejects(guards.readJson(oversized, 1024), /exceeds limit/i);
});
