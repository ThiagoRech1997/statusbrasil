import type { ServiceCardRow } from "@/lib/queries/services";

export type ContrastService = ServiceCardRow & { uptime24hPct: number };

export interface ContrastPair {
  best: ContrastService;
  worst: ContrastService;
}

const ARRECADACAO = "arrecadacao";
const ATENDIMENTO = "atendimento";

/**
 * Picks the editorial "Contraste do dia" pair: the service in
 * `category=arrecadacao` with the highest 24h uptime, and the service in
 * `category=atendimento` with the lowest 24h uptime. Services without
 * `uptime24hPct` data are ignored so we never compare against a null. Returns
 * null when either category pool has no eligible service. Inversions
 * (atendimento beating arrecadacao) are not filtered here — visual framing
 * stays editorial in the component layer.
 *
 * Pure function: takes the flat list and never queries.
 */
export function pickContrast(services: ServiceCardRow[]): ContrastPair | null {
  const arrecadacao = services
    .filter((s): s is ContrastService => s.category === ARRECADACAO && s.uptime24hPct !== null)
    .sort((a, b) => b.uptime24hPct - a.uptime24hPct || a.name.localeCompare(b.name));
  const atendimento = services
    .filter((s): s is ContrastService => s.category === ATENDIMENTO && s.uptime24hPct !== null)
    .sort((a, b) => a.uptime24hPct - b.uptime24hPct || a.name.localeCompare(b.name));

  const best = arrecadacao[0];
  const worst = atendimento[0];
  if (!best || !worst) return null;

  return { best, worst };
}
