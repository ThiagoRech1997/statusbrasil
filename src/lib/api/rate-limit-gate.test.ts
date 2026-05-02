import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const minuteMock = vi.fn();
const hourMock = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  getRateLimiter: (name: string) => {
    if (name === "api-ip-1m") return { limit: minuteMock };
    if (name === "api-ip-1h") return { limit: hourMock };
    throw new Error(`unexpected limiter bucket: ${name}`);
  },
}));

import { clientIp, isCronExempt, rateLimitedResponse, rateLimitGate } from "./rate-limit-gate";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/services", { headers });
}

beforeEach(() => {
  minuteMock.mockReset();
  hourMock.mockReset();
});

describe("clientIp", () => {
  it("uses the first hop of x-forwarded-for", () => {
    expect(clientIp(makeRequest({ "x-forwarded-for": "203.0.113.1, 198.51.100.7" }))).toBe(
      "203.0.113.1",
    );
  });

  it("trims whitespace around the first hop", () => {
    expect(clientIp(makeRequest({ "x-forwarded-for": "  203.0.113.1  " }))).toBe("203.0.113.1");
  });

  it("falls back to 'unknown' when the header is absent", () => {
    expect(clientIp(makeRequest())).toBe("unknown");
  });
});

describe("isCronExempt", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("returns true when x-cron-secret matches CRON_SECRET", () => {
    process.env.CRON_SECRET = "expected";
    expect(isCronExempt(makeRequest({ "x-cron-secret": "expected" }))).toBe(true);
  });

  it("returns false when the secret is wrong", () => {
    process.env.CRON_SECRET = "expected";
    expect(isCronExempt(makeRequest({ "x-cron-secret": "wrong" }))).toBe(false);
  });

  it("returns false when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(isCronExempt(makeRequest({ "x-cron-secret": "anything" }))).toBe(false);
  });
});

describe("rateLimitGate", () => {
  it("allows the request when both buckets have capacity", async () => {
    minuteMock.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
    hourMock.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 });

    const decision = await rateLimitGate(makeRequest({ "x-forwarded-for": "1.2.3.4" }));

    expect(decision).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(minuteMock).toHaveBeenCalledWith("ip:1.2.3.4");
    expect(hourMock).toHaveBeenCalledWith("ip:1.2.3.4");
  });

  it("denies and computes retry_after when the minute bucket is exceeded", async () => {
    const reset = Date.now() + 30_000;
    minuteMock.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset });
    hourMock.mockResolvedValue({ success: true, limit: 1000, remaining: 900, reset: 0 });

    const decision = await rateLimitGate(makeRequest({ "x-forwarded-for": "1.2.3.4" }));

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(20);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(31);
  });

  it("uses the larger reset across failing buckets when both are exceeded", async () => {
    const minReset = Date.now() + 30_000;
    const hourReset = Date.now() + 600_000;
    minuteMock.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: minReset });
    hourMock.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: hourReset });

    const decision = await rateLimitGate(makeRequest({ "x-forwarded-for": "1.2.3.4" }));

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(500);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it("allows when both limiters fail open (helper returned success after Redis error)", async () => {
    minuteMock.mockResolvedValue({ success: true, limit: 60, remaining: 60, reset: Date.now() });
    hourMock.mockResolvedValue({ success: true, limit: 1000, remaining: 1000, reset: Date.now() });

    const decision = await rateLimitGate(makeRequest({ "x-forwarded-for": "1.2.3.4" }));

    expect(decision.allowed).toBe(true);
  });

  it("returns at least 1 second retry_after even if reset is in the past", async () => {
    minuteMock.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() - 5_000,
    });
    hourMock.mockResolvedValue({ success: true, limit: 1000, remaining: 900, reset: 0 });

    const decision = await rateLimitGate(makeRequest({ "x-forwarded-for": "1.2.3.4" }));

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("keys identifier off 'unknown' when x-forwarded-for is missing", async () => {
    minuteMock.mockResolvedValue({ success: true, limit: 60, remaining: 60, reset: 0 });
    hourMock.mockResolvedValue({ success: true, limit: 1000, remaining: 1000, reset: 0 });

    await rateLimitGate(makeRequest());

    expect(minuteMock).toHaveBeenCalledWith("ip:unknown");
    expect(hourMock).toHaveBeenCalledWith("ip:unknown");
  });
});

describe("rateLimitedResponse", () => {
  it("returns 429 with Retry-After header and rate_limited body", async () => {
    const res = rateLimitedResponse(42);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toEqual({
      error: "too many requests",
      code: "rate_limited",
      retry_after: 42,
    });
  });
});
