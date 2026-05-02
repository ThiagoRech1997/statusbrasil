import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncidentRow } from "@/lib/queries/incidents";
import type { ServiceWithStatus } from "@/lib/queries/services";
import type { Rolling30dSummary } from "@/lib/queries/uptime";

const getServiceWithStatusBySlugMock = vi.fn();
const getRolling30dSummaryMock = vi.fn();
const getRecentByServiceMock = vi.fn();

vi.mock("@/lib/queries/services", () => ({
  getServiceWithStatusBySlug: getServiceWithStatusBySlugMock,
}));

vi.mock("@/lib/queries/uptime", () => ({
  getRolling30dSummary: getRolling30dSummaryMock,
}));

vi.mock("@/lib/queries/incidents", () => ({
  getRecentByService: getRecentByServiceMock,
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

function makeRequest(slug: string): Request {
  return new Request(`http://localhost/api/v1/services/${slug}`, { method: "GET" });
}

function ctx(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

const baseService: ServiceWithStatus = {
  slug: "gov-br",
  name: "Portal gov.br",
  agency: "Governo Federal",
  category: "atendimento",
  sphere: "federal",
  url: "https://www.gov.br/",
  description: "Portal único.",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  status: "operational",
  uptime1h: 99.9,
};

const baseSummary: Rolling30dSummary = {
  uptimePct: 99.95,
  totalChecks: 43200,
  failedChecks: 22,
  mttrSeconds: 1200,
};

const baseIncident: IncidentRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  serviceSlug: "gov-br",
  startedAt: new Date("2026-04-30T08:00:00Z"),
  endedAt: new Date("2026-04-30T08:30:00Z"),
  durationSeconds: 1800,
  statusCode: 503,
  errorMessage: "boom",
  severity: "partial",
};

describe("GET /api/v1/services/[slug]", () => {
  beforeEach(() => {
    getServiceWithStatusBySlugMock.mockReset();
    getRolling30dSummaryMock.mockReset();
    getRecentByServiceMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with the full detail body and Cache-Control on success", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue(baseService);
    getRolling30dSummaryMock.mockResolvedValue(baseSummary);
    getRecentByServiceMock.mockResolvedValue([baseIncident]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest("gov-br"), ctx("gov-br"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("s-maxage=60, stale-while-revalidate=300");

    const body = await res.json();
    expect(body.service).toMatchObject({
      slug: "gov-br",
      status: "operational",
      uptime_1h: 99.9,
    });
    expect(body.service).not.toHaveProperty("createdAt");
    expect(body.service).not.toHaveProperty("active");
    expect(body.uptime_pct_30d).toBe(99.95);
    expect(body.mttr_30d_seconds).toBe(1200);
    expect(body.last_incident).toMatchObject({
      id: baseIncident.id,
      service_slug: "gov-br",
      started_at: "2026-04-30T08:00:00.000Z",
      ended_at: "2026-04-30T08:30:00.000Z",
    });
  });

  it("returns last_incident=null when the service has no incidents", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue(baseService);
    getRolling30dSummaryMock.mockResolvedValue(baseSummary);
    getRecentByServiceMock.mockResolvedValue([]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest("gov-br"), ctx("gov-br"))).json();
    expect(body.last_incident).toBeNull();
  });

  it("returns null 30d metrics when there is no aggregate data", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue({
      ...baseService,
      uptime1h: null,
      status: "unknown",
    });
    getRolling30dSummaryMock.mockResolvedValue({
      uptimePct: null,
      totalChecks: 0,
      failedChecks: 0,
      mttrSeconds: null,
    });
    getRecentByServiceMock.mockResolvedValue([]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest("gov-br"), ctx("gov-br"))).json();
    expect(body.uptime_pct_30d).toBeNull();
    expect(body.mttr_30d_seconds).toBeNull();
    expect(body.last_incident).toBeNull();
    expect(body.service.status).toBe("unknown");
  });

  it("returns 404 with ApiErrorResponse and no Cache-Control when slug is unknown", async () => {
    getServiceWithStatusBySlugMock.mockResolvedValue(null);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest("missing"), ctx("missing"));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBeNull();
    const body = await res.json();
    expect(body).toMatchObject({ code: "not_found", error: expect.stringContaining("missing") });
    expect(getRolling30dSummaryMock).not.toHaveBeenCalled();
    expect(getRecentByServiceMock).not.toHaveBeenCalled();
  });

  it("returns 400 with validation_error on a malformed slug, before hitting the DB", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("Bad Slug!"), ctx("Bad Slug!"));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBeNull();
    const body = await res.json();
    expect(body.code).toBe("validation_error");
    expect(getServiceWithStatusBySlugMock).not.toHaveBeenCalled();
  });
});
