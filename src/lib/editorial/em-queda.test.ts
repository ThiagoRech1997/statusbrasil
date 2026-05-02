import { describe, expect, it } from "vitest";
import type { HomeCategoryGroup, ServiceCardRow, ServiceWithStatus } from "@/lib/queries/services";
import { pickEmQuedaAgora } from "./em-queda";

function svc(over: Partial<ServiceCardRow> & { slug: string }): ServiceCardRow {
  const base: ServiceWithStatus = {
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
  return {
    ...base,
    uptime24hPct: "uptime24hPct" in over ? (over.uptime24hPct as number | null) : null,
    uptime7dPct: "uptime7dPct" in over ? (over.uptime7dPct as number | null) : null,
    lastIncidentAt: "lastIncidentAt" in over ? (over.lastIncidentAt as Date | null) : null,
  };
}

function group(category: string, services: ServiceCardRow[]): HomeCategoryGroup {
  return { category, services };
}

const T0 = new Date("2026-05-01T12:00:00Z");
const T_MINUS_1H = new Date(T0.getTime() - 60 * 60 * 1000);
const T_MINUS_3H = new Date(T0.getTime() - 3 * 60 * 60 * 1000);
const T_MINUS_2D = new Date(T0.getTime() - 2 * 24 * 60 * 60 * 1000);

describe("pickEmQuedaAgora", () => {
  it("returns an empty list when nothing is down or degraded", () => {
    const groups = [
      group("a", [svc({ slug: "ok", status: "operational" })]),
      group("b", [svc({ slug: "huh", status: "unknown" })]),
    ];
    expect(pickEmQuedaAgora(groups)).toEqual([]);
  });

  it("flattens across categories and keeps only down or degraded", () => {
    const groups = [
      group("a", [
        svc({ slug: "ok", status: "operational" }),
        svc({ slug: "d1", status: "down", lastIncidentAt: T_MINUS_1H }),
      ]),
      group("b", [
        svc({ slug: "g1", status: "degraded", lastIncidentAt: T_MINUS_3H }),
        svc({ slug: "huh", status: "unknown" }),
      ]),
    ];
    expect(pickEmQuedaAgora(groups).map((s) => s.slug)).toEqual(["d1", "g1"]);
  });

  it("orders down before degraded regardless of recency", () => {
    const groups = [
      group("a", [
        svc({ slug: "old-down", status: "down", lastIncidentAt: T_MINUS_2D }),
        svc({ slug: "fresh-degraded", status: "degraded", lastIncidentAt: T_MINUS_1H }),
      ]),
    ];
    expect(pickEmQuedaAgora(groups).map((s) => s.slug)).toEqual(["old-down", "fresh-degraded"]);
  });

  it("breaks severity ties by lastIncidentAt descending (most recent first)", () => {
    const groups = [
      group("a", [
        svc({ slug: "older", status: "down", lastIncidentAt: T_MINUS_3H }),
        svc({ slug: "newer", status: "down", lastIncidentAt: T_MINUS_1H }),
      ]),
    ];
    expect(pickEmQuedaAgora(groups).map((s) => s.slug)).toEqual(["newer", "older"]);
  });

  it("sinks rows with null lastIncidentAt below those with a timestamp (within the same severity)", () => {
    const groups = [
      group("a", [
        svc({ slug: "no-stamp", status: "down", lastIncidentAt: null }),
        svc({ slug: "stamped", status: "down", lastIncidentAt: T_MINUS_3H }),
      ]),
    ];
    expect(pickEmQuedaAgora(groups).map((s) => s.slug)).toEqual(["stamped", "no-stamp"]);
  });

  it("falls back to alphabetical name when timestamps tie (both null included)", () => {
    const groups = [
      group("a", [
        svc({ slug: "z", name: "Zeta", status: "down", lastIncidentAt: null }),
        svc({ slug: "a", name: "Alpha", status: "down", lastIncidentAt: null }),
        svc({ slug: "m", name: "Mu", status: "down", lastIncidentAt: T_MINUS_1H }),
        svc({ slug: "b", name: "Beta", status: "down", lastIncidentAt: T_MINUS_1H }),
      ]),
    ];
    expect(pickEmQuedaAgora(groups).map((s) => s.slug)).toEqual(["b", "m", "a", "z"]);
  });

  it("applies the same null-last rule independently within each severity tier", () => {
    const groups = [
      group("a", [
        svc({ slug: "g-null", status: "degraded", lastIncidentAt: null }),
        svc({ slug: "d-null", status: "down", lastIncidentAt: null }),
        svc({ slug: "g-stamped", status: "degraded", lastIncidentAt: T_MINUS_1H }),
        svc({ slug: "d-stamped", status: "down", lastIncidentAt: T_MINUS_3H }),
      ]),
    ];
    // down (stamped, then null), then degraded (stamped, then null)
    expect(pickEmQuedaAgora(groups).map((s) => s.slug)).toEqual([
      "d-stamped",
      "d-null",
      "g-stamped",
      "g-null",
    ]);
  });
});
