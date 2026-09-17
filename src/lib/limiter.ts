import { AI_CONCURRENCY, AI_RATE_LIMIT, AI_RATE_WINDOW_MS } from "./limits";
import { RateLimiter, RateLimitError } from "./rate-limit";

const globalForLimiter = globalThis as unknown as { __studyAiLimiter?: RateLimiter };

export function getAiLimiter(): RateLimiter {
  if (!globalForLimiter.__studyAiLimiter) {
    globalForLimiter.__studyAiLimiter = new RateLimiter(AI_CONCURRENCY, AI_RATE_LIMIT, AI_RATE_WINDOW_MS);
  }
  return globalForLimiter.__studyAiLimiter;
}

export { RateLimitError };
