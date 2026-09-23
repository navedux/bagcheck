/**
 * Credit guard for cold checks. A warm token costs nothing, so the cache
 * absorbs repeat clicks on the same token. What drains credits is a stream
 * of new tokens (or new entry dates). This gate caps how many cold checks one
 * client may start per hour, and how many the whole instance may start.
 */
export type ColdGateLimits = {
  perClientPerHour: number;
  globalPerHour: number;
};

type Window = { count: number; resetAt: number };

const HOUR_MS = 3_600_000;
const MAX_CLIENTS = 10_000;

export class ColdGate {
  private readonly clients = new Map<string, Window>();
  private global: Window = { count: 0, resetAt: 0 };

  constructor(private readonly limits: () => ColdGateLimits) {}

  /**
   * Reserve one cold check. `exempt` skips the per-client cap (the fixed
   * featured set) but still counts against the global cap.
   */
  admit(client: string, now: number, exempt = false): boolean {
    const { perClientPerHour, globalPerHour } = this.limits();
    if (this.global.resetAt <= now) {
      this.global = { count: 0, resetAt: now + HOUR_MS };
    }
    if (this.global.count >= globalPerHour) return false;

    if (!exempt) {
      let window = this.clients.get(client);
      if (!window || window.resetAt <= now) {
        if (this.clients.size >= MAX_CLIENTS) this.sweep(now);
        window = { count: 0, resetAt: now + HOUR_MS };
        this.clients.set(client, window);
      }
      if (window.count >= perClientPerHour) return false;
      window.count += 1;
    }
    this.global.count += 1;
    return true;
  }

  private sweep(now: number): void {
    for (const [key, window] of this.clients) {
      if (window.resetAt <= now) this.clients.delete(key);
    }
    if (this.clients.size >= MAX_CLIENTS) {
      const oldest = this.clients.keys().next().value;
      if (oldest !== undefined) this.clients.delete(oldest);
    }
  }
}
