import { describe, expect, it } from "vitest";
import type { ServiceCardRow, ServiceWithStatus } from "@/lib/queries/services";
import { pickContrast } from "./contrastes";

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

describe("pickContrast", () => {
  it("returns the highest-uptime arrecadacao and the lowest-uptime atendimento", () => {
    const result = pickContrast([
      svc({ slug: "rf", name: "Receita Federal", category: "arrecadacao", uptime24hPct: 99.2 }),
      svc({ slug: "ecac", name: "e-CAC", category: "arrecadacao", uptime24hPct: 98.0 }),
      svc({ slug: "inss", name: "Meu INSS", category: "atendimento", uptime24hPct: 78.5 }),
      svc({ slug: "fgts", name: "FGTS", category: "atendimento", uptime24hPct: 92.0 }),
    ]);
    expect(result?.best.slug).toBe("rf");
    expect(result?.best.uptime24hPct).toBe(99.2);
    expect(result?.worst.slug).toBe("inss");
    expect(result?.worst.uptime24hPct).toBe(78.5);
  });

  it("returns null when there is no arrecadacao service with data", () => {
    const result = pickContrast([
      svc({ slug: "inss", category: "atendimento", uptime24hPct: 80 }),
      svc({ slug: "rf", category: "arrecadacao", uptime24hPct: null }),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when there is no atendimento service with data", () => {
    const result = pickContrast([
      svc({ slug: "rf", category: "arrecadacao", uptime24hPct: 99 }),
      svc({ slug: "inss", category: "atendimento", uptime24hPct: null }),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when both pools are empty", () => {
    const result = pickContrast([svc({ slug: "saude", category: "saude", uptime24hPct: 99 })]);
    expect(result).toBeNull();
  });

  it("returns null when both pools exist but all uptime24hPct values are null", () => {
    const result = pickContrast([
      svc({ slug: "rf", category: "arrecadacao", uptime24hPct: null }),
      svc({ slug: "inss", category: "atendimento", uptime24hPct: null }),
    ]);
    expect(result).toBeNull();
  });

  it("ignores services with null uptime24hPct even if they would otherwise win", () => {
    const result = pickContrast([
      svc({ slug: "missing", name: "Missing", category: "arrecadacao", uptime24hPct: null }),
      svc({ slug: "rf", name: "Receita Federal", category: "arrecadacao", uptime24hPct: 95 }),
      svc({ slug: "inss", category: "atendimento", uptime24hPct: 80 }),
    ]);
    expect(result?.best.slug).toBe("rf");
  });

  it("breaks max ties in arrecadacao alphabetically by name", () => {
    const result = pickContrast([
      svc({ slug: "z", name: "Zeta", category: "arrecadacao", uptime24hPct: 99.5 }),
      svc({ slug: "a", name: "Alpha", category: "arrecadacao", uptime24hPct: 99.5 }),
      svc({ slug: "m", name: "Mu", category: "arrecadacao", uptime24hPct: 99.5 }),
      svc({ slug: "inss", category: "atendimento", uptime24hPct: 80 }),
    ]);
    expect(result?.best.slug).toBe("a");
  });

  it("breaks min ties in atendimento alphabetically by name", () => {
    const result = pickContrast([
      svc({ slug: "rf", category: "arrecadacao", uptime24hPct: 99 }),
      svc({ slug: "z", name: "Zeta", category: "atendimento", uptime24hPct: 70 }),
      svc({ slug: "a", name: "Alpha", category: "atendimento", uptime24hPct: 70 }),
      svc({ slug: "m", name: "Mu", category: "atendimento", uptime24hPct: 70 }),
    ]);
    expect(result?.worst.slug).toBe("a");
  });

  it("returns the pair even when atendimento beats arrecadacao (data inversion)", () => {
    const result = pickContrast([
      svc({ slug: "rf", category: "arrecadacao", uptime24hPct: 80 }),
      svc({ slug: "inss", category: "atendimento", uptime24hPct: 95 }),
    ]);
    expect(result?.best.uptime24hPct).toBe(80);
    expect(result?.worst.uptime24hPct).toBe(95);
  });
});
