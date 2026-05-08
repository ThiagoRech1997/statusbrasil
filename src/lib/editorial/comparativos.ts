/**
 * Curated editorial comparisons surfaced on the `/comparativo` landing.
 *
 * Each entry pairs services that, side by side, narrate StatusBrasil's editorial
 * thesis: the asymmetry between the State that *collects* and the State that
 * *serves*. The user-facing copy (title, description, angle) lives in the
 * `Comparativo.featured.<id>` namespace of `messages/{pt,en}.json` so the data
 * here stays language-agnostic and the editorial team can iterate on tone
 * without touching code.
 *
 * Service slugs MUST exist in the seeded catalog (`scripts/seed.ts`). Each
 * comparison has 2-4 services — the same range the picker on the full
 * `/comparativo` page accepts, so cards link to a URL the page can render.
 */

export type ComparativoId =
  | "receita-vs-inss"
  | "ecac-vs-fgts"
  | "importa-vs-conectesus"
  | "govbr-vs-detran-sp"
  | "simples-vs-ctps";

export interface Comparativo {
  id: ComparativoId;
  services: readonly [string, string, ...string[]];
}

const MIN_SERVICES = 2;
const MAX_SERVICES = 4;

export const COMPARATIVOS: readonly Comparativo[] = [
  {
    id: "receita-vs-inss",
    services: ["receita-federal", "meu-inss"],
  },
  {
    id: "ecac-vs-fgts",
    services: ["e-cac", "fgts-caixa"],
  },
  {
    id: "importa-vs-conectesus",
    services: ["importa-facil", "conectesus"],
  },
  {
    id: "govbr-vs-detran-sp",
    services: ["gov-br", "detran-sp"],
  },
  {
    id: "simples-vs-ctps",
    services: ["simples-nacional", "ctps-digital"],
  },
] as const;

export function getComparativo(id: ComparativoId): Comparativo | null {
  return COMPARATIVOS.find((c) => c.id === id) ?? null;
}

/**
 * Encodes a comparativo's services for the `/comparativo?services=` URL the
 * full page (M5.4) consumes. The page expects comma-separated slugs, no
 * trailing comma, no spaces.
 */
export function comparativoQueryString(c: Comparativo): string {
  return c.services.join(",");
}

export const COMPARATIVO_LIMITS = {
  min: MIN_SERVICES,
  max: MAX_SERVICES,
} as const;
