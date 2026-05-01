import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const renderMetricsMock = vi.fn();
const loggerWarn = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  getRateLimiter: () => ({ limit: limitMock }),
}));

vi.mock("@/lib/metrics", () => ({
  renderMetrics: renderMetricsMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: loggerWarn, error: loggerError, debug: vi.fn() },
}));

async function loadRoute() {
  vi.resetModules();
  return await import("./route");
}

function makeRequest(opts: { authorization?: string; ip?: string } = {}): Request {
  const headers = new Headers();
  if (opts.authorization !== undefined) headers.set("authorization", opts.authorization);
  if (opts.ip !== undefined) headers.set("x-forwarded-for", opts.ip);
  return new Request("http://localhost/api/metrics", { method: "GET", headers });
}

describe("GET /api/metrics", () => {
  const original = process.env.METRICS_SECRET;

  beforeEach(() => {
    limitMock.mockReset();
    limitMock.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 });
    renderMetricsMock.mockReset();
    renderMetricsMock.mockResolvedValue({
      contentType: "text/plain; version=0.0.4; charset=utf-8",
      body: "# HELP foo bar\nfoo 1\n",
    });
    loggerWarn.mockReset();
    loggerError.mockReset();
    process.env.METRICS_SECRET = "secret-xyz";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.METRICS_SECRET;
    else process.env.METRICS_SECRET = original;
    vi.resetModules();
  });

  it("returns 500 when METRICS_SECRET is not configured", async () => {
    delete process.env.METRICS_SECRET;
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ authorization: "Bearer secret-xyz" }));
    expect(res.status).toBe(500);
    expect(loggerError).toHaveBeenCalled();
    expect(renderMetricsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(renderMetricsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(loggerWarn).toHaveBeenCalled();
  });

  it("returns 401 when the scheme is not Bearer", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ authorization: "Basic secret-xyz" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when the per-IP rate limit is exhausted on bad attempts", async () => {
    limitMock.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 });
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ authorization: "Bearer wrong", ip: "1.2.3.4" }));
    expect(res.status).toBe(429);
    expect(limitMock).toHaveBeenCalledWith("bad-secret:1.2.3.4");
  });

  it("returns 200 with prometheus content-type and body when authorized", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ authorization: "Bearer secret-xyz" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; version=0.0.4; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("# HELP foo bar\nfoo 1\n");
    expect(renderMetricsMock).toHaveBeenCalledOnce();
  });
});
