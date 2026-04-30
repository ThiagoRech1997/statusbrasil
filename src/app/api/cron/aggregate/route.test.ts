import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runAggregationMock = vi.fn();
const limitMock = vi.fn();

vi.mock("@/lib/aggregator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aggregator")>("@/lib/aggregator");
  return {
    ...actual,
    runAggregation: runAggregationMock,
  };
});

vi.mock("@/lib/ratelimit", () => ({
  getRateLimiter: () => ({ limit: limitMock }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function loadRoute() {
  vi.resetModules();
  return await import("./route");
}

function makeRequest(opts: { secret?: string; hours?: string } = {}): Request {
  const headers = new Headers();
  if (opts.secret !== undefined) headers.set("x-cron-secret", opts.secret);
  const url = new URL("http://localhost/api/cron/aggregate");
  if (opts.hours !== undefined) url.searchParams.set("hours", opts.hours);
  return new Request(url, { method: "POST", headers });
}

describe("POST /api/cron/aggregate", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    runAggregationMock.mockReset();
    limitMock.mockReset();
    limitMock.mockResolvedValue({ success: true, limit: 6, remaining: 5, reset: 0 });
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    vi.resetModules();
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: "anything" }));
    expect(res.status).toBe(500);
  });

  it("returns 401 when the secret header is missing", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(runAggregationMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret header does not match", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(runAggregationMock).not.toHaveBeenCalled();
  });

  it("returns 429 when bad-secret callers exceed the rate limit", async () => {
    limitMock.mockResolvedValue({ success: false, limit: 6, remaining: 0, reset: 0 });
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: "wrong" }));
    expect(res.status).toBe(429);
    expect(runAggregationMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid hours", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: "test-secret", hours: "abc" }));
    expect(res.status).toBe(400);
    expect(runAggregationMock).not.toHaveBeenCalled();
  });

  it("runs aggregation and returns the JSON summary on a valid secret", async () => {
    runAggregationMock.mockResolvedValue({
      servicesProcessed: 6,
      hoursAggregated: 12,
      incidentsOpened: 1,
      incidentsClosed: 0,
      durationMs: 42,
    });
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: "test-secret", hours: "12" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      services_processed: 6,
      hours_aggregated: 12,
      incidents_opened: 1,
      incidents_closed: 0,
      duration_ms: 42,
    });
    expect(runAggregationMock).toHaveBeenCalledWith({ hours: 12 });
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("uses the default hours (2) when query is omitted", async () => {
    runAggregationMock.mockResolvedValue({
      servicesProcessed: 0,
      hoursAggregated: 0,
      incidentsOpened: 0,
      incidentsClosed: 0,
      durationMs: 1,
    });
    const { POST } = await loadRoute();
    await POST(makeRequest({ secret: "test-secret" }));
    expect(runAggregationMock).toHaveBeenCalledWith({ hours: 2 });
  });

  it("returns 500 when the aggregator throws", async () => {
    runAggregationMock.mockRejectedValue(new Error("db down"));
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: "test-secret" }));
    expect(res.status).toBe(500);
  });
});
