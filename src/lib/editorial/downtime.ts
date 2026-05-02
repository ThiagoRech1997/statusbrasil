export interface DowntimeWorst {
  slug: string;
  name: string;
  seconds: number;
}

export interface DowntimeSummary {
  totalSeconds: number;
  worst: DowntimeWorst | null;
}

export interface NamedService {
  slug: string;
  name: string;
}

/**
 * Reduces a `slug -> seconds` downtime map to the cumulative total and the
 * single worst-affected service. Services missing from `services` are
 * ignored on the worst lookup (they still contribute to the total). Ties on
 * max downtime break alphabetically by name for stable rendering.
 *
 * Pure: takes the values that the home page already fetched.
 */
export function summarizeDowntime(
  downtimeBySlug: Record<string, number>,
  services: NamedService[],
): DowntimeSummary {
  const nameBySlug = new Map(services.map((s) => [s.slug, s.name]));
  let totalSeconds = 0;
  const candidates: DowntimeWorst[] = [];

  for (const [slug, seconds] of Object.entries(downtimeBySlug)) {
    if (seconds <= 0) continue;
    totalSeconds += seconds;
    const name = nameBySlug.get(slug);
    if (name !== undefined) candidates.push({ slug, name, seconds });
  }

  candidates.sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
  return { totalSeconds, worst: candidates[0] ?? null };
}

/**
 * Renders a duration in seconds as a human-readable string in the requested
 * locale, e.g. "5 horas e 12 minutos" / "5 hours and 12 minutes". Rounds
 * to the nearest minute and uses Intl.NumberFormat unit display + Intl
 * .ListFormat conjunction so the connector word ("e" / "and") respects
 * locale. Returns an empty string for non-positive input.
 */
export function formatDowntimeDuration(locale: string, seconds: number): string {
  if (seconds <= 0) return "";

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: "hour",
        unitDisplay: "long",
      }).format(hours),
    );
  }
  if (minutes > 0 || hours === 0) {
    parts.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: "minute",
        unitDisplay: "long",
      }).format(minutes),
    );
  }

  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(parts);
}
