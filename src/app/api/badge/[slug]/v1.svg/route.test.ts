import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const getServiceWithStatusBySlugMock = vi.fn();
const getRolling30dSummaryMock = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  getRateLimiter: () => ({ limit: limitMock }),
}));

vi.mock("@/lib/queries/services", () => ({
  getServiceWithStatusBySlug: getServiceWithStatusBySlugMock,
}));

vi.mock("@/lib/queries/uptime", () => ({
  getRolling30dSummary: getRolling30dSummaryMock,
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/metrics", () => ({
  withHttpMetrics: <T extends (...args: unknown[]) => unknown>(handler: T): T => handler,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function loadRoute() {
  vi.resetModules();
  return await import("./route");
}

function makeRequest(slug = "rf"): {
  req: Request;
  ctx: { params: Promise<{ slug: string }> };
} {
  const req = new Request(`http://localhost/api/badge/${slug}/v1.svg`);
  return { req, ctx: { params: Promise.resolve({ slug }) } };
}

describe("GET /api/badge/[slug]/v1.svg", () => {
  beforeEach(() => {
    limitMock.mockReset();
    getServiceWithStatusBySlugMock.mockReset();
    getRolling30dSummaryMock.mockReset();
    limitMock.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("renders an SVG badge with the immutable cache header for a known healthy service", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue({ slug: "rf", name: "Receita Federal" });
    getRolling30dSummaryMock.mockResolvedValue({
      uptimePct: 99.7,
      totalChecks: 100,
      failedChecks: 0,
      mttrSeconds: null,
    });

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("rf");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400, immutable");

    const body = await res.text();
    expect(body.startsWith("<svg")).toBe(true);
    expect(body).toContain("99.7%");
    expect(body).toContain("uptime");
    expect(body).toContain('fill="#4c1"'); // brightgreen for ≥99
  });

  it("paints yellow for 95-99% uptime", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue({ slug: "rf", name: "Receita Federal" });
    getRolling30dSummaryMock.mockResolvedValue({
      uptimePct: 97.2,
      totalChecks: 100,
      failedChecks: 3,
      mttrSeconds: null,
    });

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("rf");
    const res = await GET(req, ctx);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("97.2%");
    expect(body).toContain('fill="#dfb317"'); // yellow
  });

  it("paints red for <95% uptime", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue({ slug: "rf", name: "Receita Federal" });
    getRolling30dSummaryMock.mockResolvedValue({
      uptimePct: 92.0,
      totalChecks: 100,
      failedChecks: 8,
      mttrSeconds: null,
    });

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("rf");
    const res = await GET(req, ctx);
    const body = await res.text();

    expect(body).toContain("92.0%");
    expect(body).toContain('fill="#e05d44"'); // red
  });

  it("falls back to a lightgrey 'unknown' badge when uptimePct is null", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue({ slug: "rf", name: "Receita Federal" });
    getRolling30dSummaryMock.mockResolvedValue({
      uptimePct: null,
      totalChecks: 0,
      failedChecks: 0,
      mttrSeconds: null,
    });

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("rf");
    const res = await GET(req, ctx);
    const body = await res.text();

    expect(res.status).toBe(200);
    // Even "unknown" with no data is cacheable for 24h — same v1 schema.
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400, immutable");
    expect(body).toContain("unknown");
    expect(body).toContain('fill="#9f9f9f"'); // lightgrey
  });

  it("returns 404 + non-cacheable SVG for an unknown service slug", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue(null);

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("does-not-exist");
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("unknown");
    expect(body.startsWith("<svg")).toBe(true);
  });

  it("returns 400 + non-cacheable SVG for a slug that fails Slug validation", async () => {
    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("Has Spaces!");
    const res = await GET(req, ctx);

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(getServiceWithStatusBySlugMock).not.toHaveBeenCalled();
    const body = await res.text();
    expect(body).toContain("invalid slug");
  });

  it("returns 429 + non-cacheable SVG when the badge bucket is exhausted", async () => {
    limitMock.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 0 });

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("rf");
    const res = await GET(req, ctx);

    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(getServiceWithStatusBySlugMock).not.toHaveBeenCalled();
    const body = await res.text();
    expect(body).toContain("rate limited");
  });

  it("returns 500 + non-cacheable error SVG when an underlying query throws", async () => {
    getServiceWithStatusBySlugMock.mockRejectedValue(new Error("db is down"));

    const { GET } = await loadRoute();
    const { req, ctx } = makeRequest("rf");
    const res = await GET(req, ctx);

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("error");
  });

  it("rate limits per IP from x-forwarded-for", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue({ slug: "rf" });
    getRolling30dSummaryMock.mockResolvedValue({
      uptimePct: 99.9,
      totalChecks: 1,
      failedChecks: 0,
      mttrSeconds: null,
    });

    const { GET } = await loadRoute();
    const req = new Request("http://localhost/api/badge/rf/v1.svg", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    await GET(req, { params: Promise.resolve({ slug: "rf" }) });

    expect(limitMock).toHaveBeenCalledWith("203.0.113.5");
  });
});
