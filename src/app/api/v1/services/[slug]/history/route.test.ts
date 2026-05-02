import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceRow } from "@/lib/queries/services";
import type { HourlyPoint } from "@/lib/queries/uptime";

const getServiceBySlugMock = vi.fn();
const getHistoryHourlyMock = vi.fn();

vi.mock("@/lib/queries/services", () => ({
  getServiceBySlug: getServiceBySlugMock,
}));

vi.mock("@/lib/queries/uptime", () => ({
  getHistoryHourly: getHistoryHourlyMock,
}));

vi.mock("@/lib/db", () => ({ db: {} as Record<string, never> }));

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

function makeRequest(slug: string, query = ""): Request {
  return new Request(
    `http://localhost/api/v1/services/${slug}/history${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
}

function ctx(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

const baseService: ServiceRow = {
  slug: "gov-br",
  name: "Portal gov.br",
  agency: "Governo Federal",
  category: "atendimento",
  sphere: "federal",
  url: "https://www.gov.br/",
  description: null,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function point(over: Partial<HourlyPoint> & { hour: Date }): HourlyPoint {
  return {
    hour: over.hour,
    uptimePct: over.uptimePct ?? 100,
    avgLatencyMs: over.avgLatencyMs ?? 200,
    totalChecks: over.totalChecks ?? 60,
    failedChecks: over.failedChecks ?? 0,
  };
}

describe("GET /api/v1/services/[slug]/history", () => {
  beforeEach(() => {
    getServiceBySlugMock.mockReset();
    getHistoryHourlyMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with hourly buckets in snake_case and the 5min Cache-Control", async () => {
    getServiceBySlugMock.mockResolvedValue(baseService);
    const hour = new Date(Date.UTC(2026, 3, 30, 10));
    getHistoryHourlyMock.mockResolvedValue([
      point({ hour, uptimePct: 99.5, avgLatencyMs: 220, totalChecks: 60, failedChecks: 0 }),
      point({
        hour: new Date(Date.UTC(2026, 3, 30, 11)),
        uptimePct: 80,
        avgLatencyMs: 950,
        totalChecks: 60,
        failedChecks: 12,
      }),
    ]);
    const { GET } = await loadRoute();

    const res = await GET(
      makeRequest("gov-br", "from=2026-04-30T08:00:00Z&to=2026-04-30T12:00:00Z"),
      ctx("gov-br"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("s-maxage=300, stale-while-revalidate=600");

    const body = await res.json();
    expect(body.slug).toBe("gov-br");
    expect(body.range).toEqual({
      from: "2026-04-30T08:00:00.000Z",
      to: "2026-04-30T12:00:00.000Z",
    });
    expect(body.points).toEqual([
      {
        hour: "2026-04-30T10:00:00.000Z",
        uptime_pct: 99.5,
        avg_latency_ms: 220,
        total_checks: 60,
        failed_checks: 0,
      },
      {
        hour: "2026-04-30T11:00:00.000Z",
        uptime_pct: 80,
        avg_latency_ms: 950,
        total_checks: 60,
        failed_checks: 12,
      },
    ]);
  });

  it("defaults the range to (now-24h, now) when no query params are given", async () => {
    getServiceBySlugMock.mockResolvedValue(baseService);
    getHistoryHourlyMock.mockResolvedValue([]);
    const before = Date.now();
    const { GET } = await loadRoute();

    const res = await GET(makeRequest("gov-br"), ctx("gov-br"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const after = Date.now();

    const fromMs = Date.parse(body.range.from);
    const toMs = Date.parse(body.range.to);
    expect(toMs - fromMs).toBe(24 * 60 * 60 * 1000);
    expect(toMs).toBeGreaterThanOrEqual(before);
    expect(toMs).toBeLessThanOrEqual(after);

    expect(getHistoryHourlyMock).toHaveBeenCalledWith(
      expect.anything(),
      "gov-br",
      expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }),
    );
  });

  it("rejects ranges greater than 90 days with the literal {error: 'max range is 90d'}", async () => {
    getServiceBySlugMock.mockResolvedValue(baseService);
    const { GET } = await loadRoute();

    const res = await GET(
      makeRequest("gov-br", "from=2026-01-01T00:00:00Z&to=2026-04-30T00:00:00Z"),
      ctx("gov-br"),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBeNull();
    const body = await res.json();
    expect(body.error).toBe("max range is 90d");
    expect(body.code).toBe("validation_error");
    expect(getHistoryHourlyMock).not.toHaveBeenCalled();
  });

  it("returns 400 on inverted range with no DB hit", async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest("gov-br", "from=2026-04-30T10:00:00Z&to=2026-04-30T08:00:00Z"),
      ctx("gov-br"),
    );
    expect(res.status).toBe(400);
    expect(getServiceBySlugMock).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed slug before any DB call", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("Bad Slug!"), ctx("Bad Slug!"));
    expect(res.status).toBe(400);
    expect(getServiceBySlugMock).not.toHaveBeenCalled();
    expect(getHistoryHourlyMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the slug is unknown", async () => {
    getServiceBySlugMock.mockResolvedValue(null);
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("missing"), ctx("missing"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("not_found");
    expect(getHistoryHourlyMock).not.toHaveBeenCalled();
  });

  it("returns 200 with realistic mixed points (zero-check, partial-fail, recovered)", async () => {
    getServiceBySlugMock.mockResolvedValue(baseService);
    getHistoryHourlyMock.mockResolvedValue([
      point({ hour: new Date("2026-04-30T08:00:00Z"), uptimePct: 100 }),
      point({
        hour: new Date("2026-04-30T09:00:00Z"),
        uptimePct: 0,
        totalChecks: 0,
        failedChecks: 0,
      }),
      point({
        hour: new Date("2026-04-30T10:00:00Z"),
        uptimePct: 50,
        totalChecks: 60,
        failedChecks: 30,
      }),
      point({ hour: new Date("2026-04-30T11:00:00Z"), uptimePct: 100 }),
    ]);
    const { GET } = await loadRoute();

    const body = await (
      await GET(
        makeRequest("gov-br", "from=2026-04-30T08:00:00Z&to=2026-04-30T12:00:00Z"),
        ctx("gov-br"),
      )
    ).json();
    expect(body.points.map((p: { uptime_pct: number }) => p.uptime_pct)).toEqual([100, 0, 50, 100]);
    expect(body.points[1]).toMatchObject({ total_checks: 0, failed_checks: 0 });
  });
});
