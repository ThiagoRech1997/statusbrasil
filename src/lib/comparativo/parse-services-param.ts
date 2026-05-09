export const MIN_COMPARATIVO_SERVICES = 2;
export const MAX_COMPARATIVO_SERVICES = 4;

/**
 * Parses the `?services=` URL param used by /comparativo and its OG image.
 *
 * Accepts a raw comma-separated string, trims each slug, drops empty entries,
 * and caps the result at MAX_COMPARATIVO_SERVICES. Does NOT enforce the minimum
 * (MIN_COMPARATIVO_SERVICES) — callers decide what to do when fewer are given.
 */
export function parseServicesParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARATIVO_SERVICES);
}
