// @vitest-environment node
import RssParser from "rss-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncidentRow } from "@/lib/queries/incidents";
import type { ServiceRow } from "@/lib/queries/services";

const listIncidentsMock = vi.fn();
const listServicesMock = vi.fn();

vi.mock("@/lib/queries/incidents", () => ({ listIncidents: listIncidentsMock }));
vi.mock("@/lib/queries/services", () => ({ listServices: listServicesMock }));
vi.mock("@/lib/db", () => ({ db: {} }));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function makeIncident(
  id: string,
  serviceSlug = "gov-br",
  startedAt = new Date("2026-05-01T10:00:00Z"),
  overrides: Partial<IncidentRow> = {},
): IncidentRow {
  return {
    id,
    serviceSlug,
    startedAt,
    endedAt: null,
    durationSeconds: null,
    statusCode: null,
    errorMessage: null,
    severity: "partial",
    ...overrides,
  };
}

function makeService(slug: string, name: string): ServiceRow {
  return {
    slug,
    name,
    agency: "Test Agency",
    category: "atendimento",
    sphere: "federal",
    url: `https://example.test/${slug}`,
    description: null,
    active: true,
    createdAt: new Date("2026-01-01"),
  };
}

describe("GET /feed.xml", () => {
  beforeEach(() => {
    listIncidentsMock.mockReset();
    listServicesMock.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with RSS+XML content-type", async () => {
    listIncidentsMock.mockResolvedValue([]);
    listServicesMock.mockResolvedValue([]);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
  });

  it("produces a valid RSS feed parseable by rss-parser with correct item guids", async () => {
    listIncidentsMock.mockResolvedValue([
      makeIncident("inc-1", "gov-br", new Date("2026-05-01T10:00:00Z")),
      makeIncident("inc-2", "meu-inss", new Date("2026-05-02T08:00:00Z")),
    ]);
    listServicesMock.mockResolvedValue([
      makeService("gov-br", "GOV.BR"),
      makeService("meu-inss", "Meu INSS"),
    ]);
    const { GET } = await loadRoute();
    const res = await GET();
    const xml = await res.text();

    const parser = new RssParser();
    const feed = await parser.parseString(xml);

    expect(feed.title).toBe("Status Brasil — Incidentes");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]?.guid).toBe("inc-1");
    expect(feed.items[1]?.guid).toBe("inc-2");
  });

  it("includes one <category> per item matching the service slug", async () => {
    listIncidentsMock.mockResolvedValue([
      makeIncident("inc-1", "receita-federal", new Date("2026-05-01T10:00:00Z")),
    ]);
    listServicesMock.mockResolvedValue([makeService("receita-federal", "Receita Federal")]);
    const { GET } = await loadRoute();
    const res = await GET();
    const xml = await res.text();

    const parser = new RssParser({ customFields: { item: [["category", "category"]] } });
    const feed = await parser.parseString(xml);
    const item = feed.items[0] as RssParser.Item & { category?: string };
    expect(item?.category).toBe("receita-federal");
  });

  it("calls listIncidents with limit=50 (FEED_LIMIT)", async () => {
    listIncidentsMock.mockResolvedValue([]);
    listServicesMock.mockResolvedValue([]);
    const { GET } = await loadRoute();
    await GET();
    const [, opts] = listIncidentsMock.mock.calls[0] ?? [];
    expect(opts?.limit).toBe(50);
  });
});
