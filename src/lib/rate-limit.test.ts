import assert from "node:assert/strict";
import { test } from "node:test";

const limiterModule: typeof import("./rate-limit") = await import(new URL("./rate-limit.ts", import.meta.url).href);

test("rate limiter queues until a slot is released", async () => {
  const limiter = new limiterModule.RateLimiter(1, 5, 60_000);
  const first = await limiter.acquire();
  assert.equal(limiter.snapshot.active, 1);
  const pending = limiter.acquire();
  first();
  const second = await pending;
  assert.equal(limiter.snapshot.active, 1);
  second();
  assert.equal(limiter.snapshot.active, 0);
});

test("rate limiter rejects once the window count is exhausted", async () => {
  const burst = new limiterModule.RateLimiter(10, 2, 60_000);
  const a = await burst.acquire();
  const b = await burst.acquire();
  await assert.rejects(() => burst.acquire(), limiterModule.RateLimitError);
  a();
  b();
});
