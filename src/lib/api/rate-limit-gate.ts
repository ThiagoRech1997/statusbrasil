import "server-only";

import { NextResponse } from "next/server";
import { getRateLimiter } from "@/lib/ratelimit";

const PER_MINUTE = { requests: 60, window: "1 m" } as const;
const PER_HOUR = { requests: 1000, window: "1 h" } as const;

const minuteLimiter = () => getRateLimiter("api-ip-1m", PER_MINUTE);
const hourLimiter = () => getRateLimiter("api-ip-1h", PER_HOUR);

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function isCronExempt(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("x-cron-secret") === expected;
}

export interface RateLimitGateDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function rateLimitGate(req: Request): Promise<RateLimitGateDecision> {
  const identifier = `ip:${clientIp(req)}`;
  const [perMinute, perHour] = await Promise.all([
    minuteLimiter().limit(identifier),
    hourLimiter().limit(identifier),
  ]);

  if (perMinute.success && perHour.success) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const failingResets = [perMinute, perHour].filter((r) => !r.success).map((r) => r.reset);
  const reset = failingResets.length > 0 ? Math.max(...failingResets) : Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { allowed: false, retryAfterSeconds };
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "too many requests",
      code: "rate_limited" as const,
      retry_after: retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
