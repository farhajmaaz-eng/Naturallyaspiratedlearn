export class RateLimiter {
  private active = 0;
  private queue: (() => void)[] = [];
  private hits: number[] = [];
  private readonly concurrency: number;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(concurrency: number, limit: number, windowMs: number) {
    this.concurrency = concurrency;
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<() => void> {
    const now = Date.now();
    this.hits = this.hits.filter((time) => now - time < this.windowMs);
    if (this.hits.length >= this.limit) throw new RateLimitError("Rate limit reached; try again shortly.");
    if (this.active >= this.concurrency) {
      const slot = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = this.queue.indexOf(entry);
          if (index !== -1) this.queue.splice(index, 1);
          reject(new Error("concurrency timeout"));
        }, this.windowMs);
        const entry = () => {
          clearTimeout(timer);
          resolve();
        };
        this.queue.push(entry);
      });
      try {
        await slot;
      } catch {
        throw new RateLimitError("Too many concurrent AI requests; try again shortly.");
      }
    }
    this.active++;
    this.hits.push(Date.now());
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.queue.shift()?.();
    };
  }

  get snapshot() {
    return { active: this.active, queued: this.queue.length };
  }
}

export class RateLimitError extends Error {}
