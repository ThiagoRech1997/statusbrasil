import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryGroup, ServiceWithStatus } from "@/lib/queries/services";

const getServicesByCategoryStatusMock = vi.fn();
const getBatchRollingUptimeSummaryMock = vi.fn();
const rateLimitGateMock = vi.fn();
const rateLimitedResponseMock = vi.fn();

vi.mock("@/lib/queries/services", () => ({
  getServicesByCategoryStatus: getServicesByCategoryStatusMock,
}));

vi.mock("@/lib/queries/uptime", () => ({
  getBatchRollingUptimeSummary: getBatchRollingUptimeSummaryMock,
}));

vi.mock("@/lib/db", () => ({ db: {} as Record<string, never> }));

vi.mock("@/lib/metrics", () => ({
  withHttpMetrics: <T extends (...args: unknown[]) => unknown>(handler: T): T => handler,
}));

vi.mock("@/lib/api/rate-limit-gate", () => ({
  rateLimitGate: rateLimitGateMock,
  rateLimitedResponse: rateLimitedResponseMock,
}));

async function loadRoute() {
  vi.resetModules();
  return await import("./route");
}

function makeRequest(query = ""): Request {
  return new Request(`http://localhost/api/v1/services.csv${query ? `?${query}` : ""}`, {
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
    url: `https://example.test/${over.slug}`,
    description: null,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    status: over.status ?? "operational",
    uptime1h: "uptime1h" in over ? (over.uptime1h as number | null) : 100,
  };
}

function group(category: string, services: ServiceWithStatus[]): CategoryGroup {
  return { category, services: services.map((s) => ({ ...s, category })) };
}

/**
 * Split CSV text into data-row slug arrays (skips header).
 * Response.text() strips the leading BOM, so the first line is the header.
 */
function dataRowSlugs(text: string): string[] {
  return text
    .split("\r\n")
    .slice(1) // drop header line (BOM already stripped by Response.text())
    .filter(Boolean)
    .map((line) => {
      const first = line.split(",")[0] ?? "";
      return first.startsWith('"') ? first.slice(1, -1).replace(/""/g, '"') : first;
    });
}

describe("GET /api/v1/services.csv", () => {
  beforeEach(() => {
    getServicesByCategoryStatusMock.mockReset();
    getBatchRollingUptimeSummaryMock.mockReset();
    rateLimitGateMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    getBatchRollingUptimeSummaryMock.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  it("returns 200 with correct content-type and content-disposition", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([group("x", [svc({ slug: "a" })])]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="statusbrasil-ranking-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
  });

  it("starts with a UTF-8 BOM (bytes 0xEF 0xBB 0xBF)", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([group("x", [svc({ slug: "a" })])]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    // Use arrayBuffer() — Response.text() strips the BOM before returning.
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });

  it("uses CRLF line endings between rows", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "a" }), svc({ slug: "b" })]),
    ]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    const text = await res.text();
    expect(text).toContain("\r\n");
    // No bare LF outside CRLF sequences
    const withoutCRLF = text.replace(/\r\n/g, "");
    expect(withoutCRLF).not.toContain("\n");
  });

  it("emits the header row with all expected columns", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([group("x", [svc({ slug: "a" })])]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    // Response.text() strips the BOM; the first line is the header.
    const text = await res.text();
    const headerLine = text.split("\r\n")[0] ?? "";
    expect(headerLine).toBe(
      "slug,name,agency,category,sphere,status,uptime_30d,uptime_90d,mttr_30d,last_incident_at",
    );
  });

  // ── CSV cell escaping ───────────────────────────────────────────────────────

  it("does not quote a plain value", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "gov-br", name: "GovBr" })]),
    ]);
    const { GET } = await loadRoute();

    const text = await (await GET(makeRequest())).text();
    expect(text).toContain("gov-br,GovBr,");
  });

  it("wraps values containing commas in double quotes", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "a", name: "Alpha, Inc." })]),
    ]);
    const { GET } = await loadRoute();

    const text = await (await GET(makeRequest())).text();
    expect(text).toContain('"Alpha, Inc."');
  });

  it("escapes double quotes by doubling them (RFC 4180)", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "a", name: 'Say "Hello"' })]),
    ]);
    const { GET } = await loadRoute();

    const text = await (await GET(makeRequest())).text();
    expect(text).toContain('"Say ""Hello"""');
  });

  it("wraps values containing newlines in double quotes", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "a", name: "Line1\nLine2" })]),
    ]);
    const { GET } = await loadRoute();

    const text = await (await GET(makeRequest())).text();
    expect(text).toContain('"Line1\nLine2"');
  });

  // ── Sorting ─────────────────────────────────────────────────────────────────

  it("sorts by name ascending by default", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [svc({ slug: "b", name: "Beta" }), svc({ slug: "a", name: "Alpha" })]),
    ]);
    const { GET } = await loadRoute();

    const slugs = dataRowSlugs(await (await GET(makeRequest())).text());
    expect(slugs).toEqual(["a", "b"]);
  });

  it("sorts by status: down → degraded → unknown → operational", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "u", name: "U", status: "unknown" }),
        svc({ slug: "g", name: "G", status: "degraded" }),
        svc({ slug: "d", name: "D", status: "down" }),
        svc({ slug: "o", name: "O", status: "operational" }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const slugs = dataRowSlugs(await (await GET(makeRequest("sort=status"))).text());
    expect(slugs).toEqual(["d", "g", "o", "u"]);
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

    const slugs = dataRowSlugs(await (await GET(makeRequest("sort=uptime"))).text());
    expect(slugs).toEqual(["high", "mid", "no-data"]);
  });

  it("sorts by category name then service name", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("trabalho", [svc({ slug: "w", name: "Work", category: "trabalho" })]),
      group("atendimento", [svc({ slug: "a", name: "Alpha", category: "atendimento" })]),
    ]);
    const { GET } = await loadRoute();

    const slugs = dataRowSlugs(await (await GET(makeRequest("sort=category"))).text());
    expect(slugs).toEqual(["a", "w"]); // atendimento < trabalho
  });

  // ── Filtering ───────────────────────────────────────────────────────────────

  it("filters by category", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("saude", [svc({ slug: "h" })]),
      group("trabalho", [svc({ slug: "w" })]),
    ]);
    const { GET } = await loadRoute();

    const slugs = dataRowSlugs(await (await GET(makeRequest("category=saude"))).text());
    expect(slugs).toEqual(["h"]);
  });

  it("filters by status", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "ok", status: "operational" }),
        svc({ slug: "bad", status: "down" }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const slugs = dataRowSlugs(await (await GET(makeRequest("status=down"))).text());
    expect(slugs).toEqual(["bad"]);
  });

  it("filters by sphere", async () => {
    getServicesByCategoryStatusMock.mockResolvedValue([
      group("x", [
        svc({ slug: "fed", sphere: "federal" }),
        svc({ slug: "est", sphere: "estadual" }),
      ]),
    ]);
    const { GET } = await loadRoute();

    const slugs = dataRowSlugs(await (await GET(makeRequest("sphere=estadual"))).text());
    expect(slugs).toEqual(["est"]);
  });

  // ── Rate limiting ───────────────────────────────────────────────────────────

  it("returns 429 when the rate limit gate blocks the request", async () => {
    rateLimitGateMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    rateLimitedResponseMock.mockReturnValue(new Response(null, { status: 429 }));
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });
});
