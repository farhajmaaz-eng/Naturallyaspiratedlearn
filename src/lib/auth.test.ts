import assert from "node:assert/strict";
import { test } from "node:test";

const auth: typeof import("./auth") = await import(new URL("./auth.ts", import.meta.url).href);

test("sessions expire after seven days and reject tampering or changed passwords", () => {
  const now = 1_800_000_000_000;
  const token = auth.createSession("test-password", now);
  assert.equal(auth.verifySession(token, "test-password", now), true);
  assert.equal(auth.verifySession(token, "test-password", now + auth.SESSION_SECONDS * 1000), false);
  assert.equal(auth.verifySession(token, "different-password", now), false);
  assert.equal(auth.verifySession(token + "a", "test-password", now), false);
  assert.equal(auth.verifySession(token, "", now), false);
  assert.equal(auth.verifySession("bad", "test-password", now), false);
});

test("password checks and cookies fail closed", () => {
  assert.equal(auth.passwordMatches("secret", "secret"), true);
  assert.equal(auth.passwordMatches("bad", "secret"), false);
  assert.equal(auth.passwordMatches("", ""), false);
  assert.match(auth.sessionCookie("token", true), /HttpOnly; SameSite=Strict; Max-Age=604800; Secure/);
  assert.match(auth.sessionCookie("", false), /Max-Age=0$/);
  assert.throws(() => auth.createSession(""));
});
