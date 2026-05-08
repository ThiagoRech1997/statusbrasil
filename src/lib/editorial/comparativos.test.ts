import { describe, expect, it } from "vitest";
import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt.json";
import {
  COMPARATIVO_LIMITS,
  COMPARATIVOS,
  type Comparativo,
  type ComparativoId,
  comparativoQueryString,
  getComparativo,
} from "./comparativos";

// Slugs from `scripts/seed.ts`. Kept inline so the test pins what the editorial
// data depends on — if a slug is renamed in the seed, this list and the
// comparativos below must move together.
const KNOWN_SLUGS = new Set([
  "gov-br",
  "receita-federal",
  "e-cac",
  "simples-nacional",
  "simei",
  "importa-facil",
  "meu-inss",
  "fgts-caixa",
  "conectesus",
  "e-sus-aps",
  "ctps-digital",
  "sine",
  "agendamento-pf",
  "justica-eleitoral",
  "detran-sp",
  "detran-rj",
  "detran-mg",
]);

describe("COMPARATIVOS", () => {
  it("exposes exactly 5 curated entries (TFR-93 acceptance)", () => {
    expect(COMPARATIVOS).toHaveLength(5);
  });

  it("uses the editorial pairing the ticket specifies", () => {
    const byId = new Map<ComparativoId, Comparativo>(COMPARATIVOS.map((c) => [c.id, c]));
    expect(byId.get("receita-vs-inss")?.services).toEqual(["receita-federal", "meu-inss"]);
    expect(byId.get("ecac-vs-fgts")?.services).toEqual(["e-cac", "fgts-caixa"]);
    expect(byId.get("importa-vs-conectesus")?.services).toEqual(["importa-facil", "conectesus"]);
    expect(byId.get("govbr-vs-detran-sp")?.services).toEqual(["gov-br", "detran-sp"]);
    expect(byId.get("simples-vs-ctps")?.services).toEqual(["simples-nacional", "ctps-digital"]);
  });

  it("has unique ids", () => {
    const ids = COMPARATIVOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects the 2–4 services-per-comparativo range", () => {
    for (const c of COMPARATIVOS) {
      expect(c.services.length).toBeGreaterThanOrEqual(COMPARATIVO_LIMITS.min);
      expect(c.services.length).toBeLessThanOrEqual(COMPARATIVO_LIMITS.max);
    }
  });

  it("only references services that exist in the seeded catalog", () => {
    for (const c of COMPARATIVOS) {
      for (const slug of c.services) {
        expect(KNOWN_SLUGS, `slug "${slug}" in comparativo "${c.id}"`).toContain(slug);
      }
    }
  });

  it("does not repeat services within a single comparativo", () => {
    for (const c of COMPARATIVOS) {
      expect(new Set(c.services).size, `comparativo "${c.id}"`).toBe(c.services.length);
    }
  });
});

describe("comparativoQueryString", () => {
  it("joins slugs with commas, no spaces", () => {
    expect(
      comparativoQueryString({
        id: "receita-vs-inss",
        services: ["receita-federal", "meu-inss"],
      }),
    ).toBe("receita-federal,meu-inss");
  });

  it("preserves order (matters for the picker's URL roundtrip)", () => {
    expect(
      comparativoQueryString({
        id: "govbr-vs-detran-sp",
        services: ["gov-br", "detran-sp"],
      }),
    ).toBe("gov-br,detran-sp");
  });
});

describe("getComparativo", () => {
  it("returns the matching entry", () => {
    expect(getComparativo("ecac-vs-fgts")?.services).toEqual(["e-cac", "fgts-caixa"]);
  });

  it("returns null for an unknown id", () => {
    expect(getComparativo("nope" as ComparativoId)).toBeNull();
  });
});

describe("Comparativo i18n parity", () => {
  // Editorial copy lives in messages/{pt,en}.json under
  // `Comparativo.featured.<id>`. This test fails loudly if either locale falls
  // out of sync with the curated list, so the cards never render with a
  // missing-key fallback.
  const REQUIRED_KEYS = ["title", "angle", "description"] as const;

  it("has PT copy for every comparativo", () => {
    const pt = (ptMessages as { Comparativo: { featured: Record<string, unknown> } }).Comparativo
      .featured;
    for (const c of COMPARATIVOS) {
      const entry = pt[c.id];
      expect(entry, `messages/pt.json missing Comparativo.featured.${c.id}`).toBeDefined();
      for (const key of REQUIRED_KEYS) {
        expect(
          (entry as Record<string, string>)[key],
          `messages/pt.json missing Comparativo.featured.${c.id}.${key}`,
        ).toBeTruthy();
      }
    }
  });

  it("has EN copy for every comparativo", () => {
    const en = (enMessages as { Comparativo: { featured: Record<string, unknown> } }).Comparativo
      .featured;
    for (const c of COMPARATIVOS) {
      const entry = en[c.id];
      expect(entry, `messages/en.json missing Comparativo.featured.${c.id}`).toBeDefined();
      for (const key of REQUIRED_KEYS) {
        expect(
          (entry as Record<string, string>)[key],
          `messages/en.json missing Comparativo.featured.${c.id}.${key}`,
        ).toBeTruthy();
      }
    }
  });
});
