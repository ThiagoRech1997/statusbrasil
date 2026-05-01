import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeCursor } from "@/lib/api/cursor";
import type { CategoryGroup, ServiceWithStatus } from "@/lib/queries/services";

const getServicesByCategoryStatusMock = vi.fn();

vi.mock("@/lib/queries/services", () => ({
  getServicesByCategoryStatus: getServicesByCategoryStatusMock,
}));

vi.mock("@/lib/db", () => ({
  db: {} as Record<string, never>,
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

function makeRequest(query = ""): Request {
  return new Request(`http://localhost/api/v1/services${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

function svc(over: Partial<ServiceWithStatus> & { slug: string }): ServiceWithStatus {
  return {
    slug: over.slug,
    name: over.name ?? over.slug,
    agency: over.agency ?? "Test Agency",
    category: over.category ?? "atendimento",
    sphere: over.sphere ?? "federal",
    url: over.url ?? `https://example.test/${over.slug}`,
    description: over.description ?? null,
    active: over.active ?? true,
    createdAt: over.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    status: over.status ?? "operational",
    uptime1h: "uptime1h" in over ? (over.uptime1h as number | null) : 100,
  };
}

function group(category: string, services: ServiceWithStatus[]): CategoryGroup {
  return {
    category,
    services: services.map((s) => ({ ...s, category })),
  };
}

describe("GET /api/v1/services", () => {
  beforeEach(() => {
    getServicesByCategoryStatusMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with the default sort (name asc) and Cache-Control header", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("saude", [svc({ slug: "b", name: "Beta" }), svc({ slug: "a", name: "Alpha" })]),
    ]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("s-maxage=60, stale-while-revalidate=300");
    const body = await res.json();
    expect(body.data.map((s: { slug: string }) => s.slug)).toEqual(["a", "b"]);
    expect(body.next_cursor).toBeUndefined();
  });

  it("strips fields not in the public ServiceItem shape", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([group("x", [svc({ slug: "a" })])]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest())).json();
    expect(body.data[0]).not.toHaveProperty("createdAt");
    expect(body.data[0]).not.toHaveProperty("active");
    expect(body.data[0]).toMatchObject({
      slug: "a",
      status: "operational",
      uptime_1h: 100,
    });
  });

  it("filters by category", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("saude", [svc({ slug: "h" })]),
      group("trabalho", [svc({ slug: "w" })]),
    ]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest("category=saude"))).json();
    expect(body.data.map((s: { slug: string }) => s.slug)).toEqual(["h"]);
  });

  it("filters by status", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "ok", status: "operational" }),
        svc({ slug: "bad", status: "down" }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest("status=down"))).json();
    expect(body.data.map((s: { slug: string }) => s.slug)).toEqual(["bad"]);
  });

  it("sorts by status with severity-first ordering (down < degraded < operational < unknown)", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "u", name: "U", status: "unknown" }),
        svc({ slug: "g", name: "G", status: "degraded" }),
        svc({ slug: "d", name: "D", status: "down" }),
        svc({ slug: "o", name: "O", status: "operational" }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest("sort=status"))).json();
    expect(body.data.map((s: { slug: string }) => s.slug)).toEqual(["d", "g", "o", "u"]);
  });

  it("sorts by uptime descending with nulls last", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "mid", name: "Mid", uptime1h: 95 }),
        svc({ slug: "no-data", name: "No Data", uptime1h: null }),
        svc({ slug: "high", name: "High", uptime1h: 100 }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest("sort=uptime"))).json();
    expect(body.data.map((s: { slug: string }) => s.slug)).toEqual(["high", "mid", "no-data"]);
  });

  it("paginates with limit and emits next_cursor when more remain", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "a", name: "A" }),
        svc({ slug: "b", name: "B" }),
        svc({ slug: "c", name: "C" }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const page1 = await (await GET(makeRequest("limit=2"))).json();
    expect(page1.data.map((s: { slug: string }) => s.slug)).toEqual(["a", "b"]);
    expect(page1.next_cursor).toBeDefined();

    const page2 = await (
      await GET(makeRequest(`limit=2&cursor=${encodeURIComponent(page1.next_cursor)}`))
    ).json();
    expect(page2.data.map((s: { slug: string }) => s.slug)).toEqual(["c"]);
    expect(page2.next_cursor).toBeUndefined();
  });

  it("returns 400 on a non-numeric limit, with ApiErrorResponse shape and no Cache-Control", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest("limit=abc"));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBeNull();
    const body = await res.json();
    expect(body).toMatchObject({ code: "validation_error", error: expect.any(String) });
    expect(body.details).toEqual(expect.objectContaining({ limit: expect.any(Array) }));
    expect(getServicesByCategoryStatusMock).not.toHaveBeenCalled();
  });

  it("returns 400 on limit > 100", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("limit=101"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on a malformed cursor", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([group("x", [svc({ slug: "a" })])]);
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("cursor=not-a-real-cursor"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
    expect(body.details).toEqual(expect.objectContaining({ cursor: expect.any(Array) }));
  });

  it("accepts a roundtripped cursor produced by encodeCursor", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "a" }), svc({ slug: "b" })]),
    ]);
    const { GET } = await loadRoute();

    const cursor = encodeCursor({ offset: 1 });
    const res = await GET(makeRequest(`cursor=${encodeURIComponent(cursor)}&limit=10`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((s: { slug: string }) => s.slug)).toEqual(["b"]);
  });
});
