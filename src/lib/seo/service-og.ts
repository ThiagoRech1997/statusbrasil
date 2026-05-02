/**
 * Pure data shape for the per-service OpenGraph image.
 *
 * Lives outside the route handler so it can be unit-tested without booting
 * the Edge runtime / Satori. The route in
 * `src/app/[locale]/servico/[slug]/opengraph-image.tsx` translates labels
 * via next-intl and feeds them into the JSX returned by `<ImageResponse>`.
 */

export type OgServiceStatus = "operational" | "degraded" | "down" | "unknown";

export interface ServiceOgInput {
  serviceName: string;
  agency: string;
  status: OgServiceStatus;
  uptimePct30d: number | null;
}

export interface ServiceOgContent {
  serviceName: string;
  agency: string;
  status: OgServiceStatus;
  /** Hex color for the status accent, theme-independent. */
  accentHex: string;
  /** "99.7%" — or null when no uptime data is available. */
  uptimeText: string | null;
}

const STATUS_HEX: Record<OgServiceStatus, string> = {
  operational: "#4ade80",
  degraded: "#facc15",
  down: "#f87171",
  unknown: "#94a3b8",
};

export function statusAccentHex(status: OgServiceStatus): string {
  return STATUS_HEX[status];
}

export function formatOgUptime(pct: number | null): string | null {
  if (pct == null) return null;
  return `${pct.toFixed(1)}%`;
}

export function buildServiceOgContent(input: ServiceOgInput): ServiceOgContent {
  return {
    serviceName: input.serviceName,
    agency: input.agency,
    status: input.status,
    accentHex: statusAccentHex(input.status),
    uptimeText: formatOgUptime(input.uptimePct30d),
  };
}
