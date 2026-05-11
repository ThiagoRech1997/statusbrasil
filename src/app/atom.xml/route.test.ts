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

async function loadAtomRoute() {
  vi.resetModules();
  return import("./route");
}

async function loadRssRoute() {
  vi.resetModules();
  return import("../feed.xml/route");
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

function makeService(slug: string, name = slug): ServiceRow {
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

describe("GET /atom.xml", () => {
  beforeEach(() => {
    listIncidentsMock.mockReset();
    listServicesMock.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with Atom content-type", async () => {
    listIncidentsMock.mockResolvedValue([]);
    listServicesMock.mockResolvedValue([]);
    const { GET } = await loadAtomRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/atom+xml");
  });

  it("produces valid Atom XML parseable by rss-parser", async () => {
    listIncidentsMock.mockResolvedValue([
      makeIncident("inc-1", "gov-br", new Date("2026-05-01T10:00:00Z")),
      makeIncident("inc-2", "meu-inss", new Date("2026-05-02T08:00:00Z")),
    ]);
    listServicesMock.mockResolvedValue([
      makeService("gov-br", "GOV.BR"),
      makeService("meu-inss", "Meu INSS"),
    ]);
    const { GET } = await loadAtomRoute();
    const res = await GET();
    const xml = await res.text();

    const parser = new RssParser();
    const feed = await parser.parseString(xml);
    expect(feed.title).toBe("Status Brasil — Incidentes");
    expect(feed.items).toHaveLength(2);
  });

  it("mirrors the same set of items as the RSS feed (same IDs, same order)", async () => {
    const incidents = [
      makeIncident("inc-alpha", "gov-br", new Date("2026-05-03T10:00:00Z")),
      makeIncident("inc-beta", "meu-inss", new Date("2026-05-02T09:00:00Z")),
      makeIncident("inc-gamma", "receita-federal", new Date("2026-05-01T08:00:00Z")),
    ];
    const services = [
      makeService("gov-br"),
      makeService("meu-inss"),
      makeService("receita-federal"),
    ];

    listIncidentsMock.mockResolvedValue(incidents);
    listServicesMock.mockResolvedValue(services);
    const atomRoute = await loadAtomRoute();
    const atomXml = await (await atomRoute.GET()).text();

    listIncidentsMock.mockResolvedValue(incidents);
    listServicesMock.mockResolvedValue(services);
    const rssRoute = await loadRssRoute();
    const rssXml = await (await rssRoute.GET()).text();

    const parser = new RssParser();
    const atomFeed = await parser.parseString(atomXml);
    const rssFeed = await parser.parseString(rssXml);

    const atomIds = atomFeed.items.map((i) => i.link?.split("/").pop() ?? "");
    const rssGuids = rssFeed.items.map((i) => i.guid ?? "");

    expect(atomIds).toEqual(rssGuids);
  });
});
