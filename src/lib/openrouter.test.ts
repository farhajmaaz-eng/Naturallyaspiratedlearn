import assert from "node:assert/strict";
import { test } from "node:test";

const openrouter: typeof import("./openrouter") = await import(new URL("./openrouter.ts", import.meta.url).href);

test("keys resolve per request and fail closed on invalid input", () => {
  const header = new Request("https://app/api", { headers: { "x-openrouter-key": "sk-or-abcdefghijklmnop" } });
  assert.equal(openrouter.resolveKey(header), "sk-or-abcdefghijklmnop");
  const env = new Request("https://app/api");
  process.env.OPENROUTER_API_KEY = "sk-or-environmentkey12345";
  assert.equal(openrouter.resolveKey(env), "sk-or-environmentkey12345");
  delete process.env.OPENROUTER_API_KEY;
  assert.equal(openrouter.resolveKey(env), null);
  assert.throws(() => openrouter.resolveKey(new Request("https://app/api", { headers: { "x-openrouter-key": "not-a-key" } })));
});

test("model resolution prefers the request body then environment defaults", () => {
  process.env.OPENROUTER_MODEL = "env/model";
  const body = { model: " body/model " };
  assert.equal(openrouter.resolveModel(new Request("https://app/api"), body), "body/model");
  assert.equal(openrouter.resolveModel(new Request("https://app/api"), {}), "env/model");
  delete process.env.OPENROUTER_MODEL;
  assert.equal(openrouter.resolveModel(new Request("https://app/api"), {}), openrouter.DEFAULT_MODEL);
  assert.throws(() => openrouter.resolveModel(new Request("https://app/api"), { model: "bad model!" }));
});

test("chat sends the key in the OpenRouter authorization header", async () => {
  const originalFetch = globalThis.fetch;
  let authorization = "";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({ choices: [{ message: { content: "Grounded answer" } }] });
  }) as typeof fetch;
  try {
    const content = await openrouter.chat("sk-or-testkey123456789", "openai/gpt-4o-mini", [{ role: "user", content: "Question" }]);
    assert.equal(content, "Grounded answer");
    assert.equal(authorization, "Bearer sk-or-testkey123456789");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("structured responses tolerate fenced JSON", () => {
  assert.deepEqual(openrouter.parseJsonObject<{ cards: unknown[] }>("```json\n{\"cards\":[]}\n```"), { cards: [] });
});
