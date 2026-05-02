import type { HomeCategoryGroup, ServiceCardRow } from "@/lib/queries/services";

export type EmQuedaService = ServiceCardRow & { status: "down" | "degraded" };

const SEVERITY_RANK: Record<EmQuedaService["status"], number> = {
  down: 0,
  degraded: 1,
};

/**
 * Selects the services worth flagging in the "Em queda agora" banner: only
 * `down` or `degraded` rows, sorted severity-first then by last-update
 * (most recent first, nulls last), then alphabetically by name as a stable
 * tiebreaker.
 *
 * Pure — accepts the already-fetched home dashboard groups so the page
 * doesn't re-query.
 */
export function pickEmQuedaAgora(groups: HomeCategoryGroup[]): EmQuedaService[] {
  const flagged = groups
    .flatMap((g) => g.services)
    .filter((s): s is EmQuedaService => s.status === "down" || s.status === "degraded");

  flagged.sort((a, b) => {
    const severity = SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status];
    if (severity !== 0) return severity;

    const aMs = a.lastIncidentAt?.getTime() ?? null;
    const bMs = b.lastIncidentAt?.getTime() ?? null;
    if (aMs !== bMs) {
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      return bMs - aMs;
    }

    return a.name.localeCompare(b.name);
  });

  return flagged;
}
