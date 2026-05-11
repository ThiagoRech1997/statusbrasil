// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceRow } from "@/lib/queries/services";

const listServicesMock = vi.fn();

vi.mock("@/lib/queries/services", () => ({ listServices: listServicesMock }));
vi.mock("server-only", () => ({}));

// Chainable mock for db.select().from().where().orderBy() / .groupBy()
const mockSelectFn = vi.fn();
const mockDb = { select: mockSelectFn };

vi.mock("@/lib/db", () => ({ db: mockDb }));

const STATIC_COUNT = 7; // 6 STATIC_ROUTES + /api/docs

function makeService(slug: string): ServiceRow {
  return {
    slug,
    name: slug,
    agency: "Test Agency",
    category: "atendimento",
    sphere: "federal",
    url: `https://example.test/${slug}`,
    description: null,
    active: true,
    createdAt: new Date("2026-01-01"),
  };
}

function setupDbSelectChain(
  incidentsWithin90d: { id: string; startedAt: Date }[] = [],
  lastmods: { serviceSlug: string; latestAt: Date | null }[] = [],
) {
  mockSelectFn.mockReset();
  mockSelectFn
    .mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(incidentsWithin90d),
    })
    .mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(lastmods),
    });
}

async function loadSitemap() {
  vi.resetModules();
  return import("./sitemap");
}

describe("sitemap", () => {
  beforeEach(() => {
    listServicesMock.mockReset();
    mockSelectFn.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("total entries = 7 static + N active services + M incidents within 90 days", async () => {
    const services = [makeService("svc-a"), makeService("svc-b"), makeService("svc-c")];
    const incidents = [
      { id: "inc-1", startedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000) },
      { id: "inc-2", startedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000) },
    ];

    listServicesMock.mockResolvedValue(services);
    setupDbSelectChain(incidents, []);

    const { default: sitemap } = await loadSitemap();
    const entries = await sitemap();

    expect(entries).toHaveLength(STATIC_COUNT + 3 + 2);
  });

  it("incidents older than 90 days are excluded by the query boundary", async () => {
    const services = [makeService("svc-a")];
    // 0 incidents within 90d (the old one is excluded by the DB where clause)
    const incidents: { id: string; startedAt: Date }[] = [];

    listServicesMock.mockResolvedValue(services);
    setupDbSelectChain(incidents, []);

    const { default: sitemap } = await loadSitemap();
    const entries = await sitemap();

    expect(entries).toHaveLength(STATIC_COUNT + 1);
  });

  it("degrades to 7 static entries when the database is unavailable", async () => {
    listServicesMock.mockRejectedValue(new Error("DB connection refused"));
    mockSelectFn.mockImplementation(() => {
      throw new Error("DB connection refused");
    });

    const { default: sitemap } = await loadSitemap();
    const entries = await sitemap();

    expect(entries).toHaveLength(STATIC_COUNT);
  });

  it("service entry URLs use the /pt/servico/{slug} pattern", async () => {
    listServicesMock.mockResolvedValue([makeService("gov-br")]);
    setupDbSelectChain([], []);

    const { default: sitemap } = await loadSitemap();
    const entries = await sitemap();

    const serviceEntry = entries.find((e) => e.url.includes("/servico/gov-br"));
    expect(serviceEntry).toBeDefined();
    expect(serviceEntry?.url).toBe("http://localhost:3000/pt/servico/gov-br");
  });
});
