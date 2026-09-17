import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "study_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

function secret(password: string) {
  return createHmac("sha256", password).update("study-app/session/v1").digest();
}

export function passwordMatches(candidate: string, password: string): boolean {
  if (!password || candidate.length > 1024) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(candidate), hash(password));
}

export function createSession(password: string, now = Date.now()): string {
  if (!password) throw new Error("APP_PASSWORD is required");
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("base64url")}`;
  const signature = createHmac("sha256", secret(password)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token: string, password: string, now = Date.now()): boolean {
  if (!password || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiry, nonce, signature] = parts;
  if (!/^\d{10,12}$/.test(expiry) || !/^[\w-]{32}$/.test(nonce) || !/^[\w-]{43}$/.test(signature)) return false;
  const expires = Number(expiry);
  const current = Math.floor(now / 1000);
  if (expires <= current || expires > current + SESSION_SECONDS) return false;
  const expected = createHmac("sha256", secret(password)).update(`${expiry}.${nonce}`).digest();
  const actual = Buffer.from(signature, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function authenticated(request: Request): boolean {
  const password = process.env.APP_PASSWORD ?? "";
  if (!password) return true;
  const cookies = (request.headers.get("cookie") ?? "").split(";");
  const token = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return !!token && verifySession(token.slice(COOKIE_NAME.length + 1), password);
}

export function sessionCookie(token: string, production = process.env.NODE_ENV === "production"): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${production ? "; Secure" : ""}`;
}
