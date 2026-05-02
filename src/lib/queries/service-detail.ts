import "server-only";

import { and, asc, between, eq, gte, lte, sum } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { serviceUptimeHourly } from "@/lib/db/schema";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface DailyUptimePoint {
  /** UTC midnight of the day. */
  date: Date;
  /** Aggregated uptime percentage for the day, or null when no checks were recorded. */
  uptimePct: number | null;
  /** Count of incidents that started during the day (UTC). */
  incidentCount: number;
}

export interface DailyUptimeOptions {
  now?: Date;
}

export interface YearToDateSummary {
  uptimePct: number | null;
  totalChecks: number;
  failedChecks: number;
}

export interface LatencySamplePoint {
  timestamp: Date;
  /** We only persist `avg_latency_ms` today; surfaced as p50 with p95=null until we capture quantiles. */
  p50: number | null;
  p95: number | null;
}

export type LatencyWindowKey = "1d" | "7d" | "30d" | "90d";

const WINDOW_HOURS: Record<LatencyWindowKey, number> = {
  "1d": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

/**
 * Returns 90 daily points (most-recent last) by rolling up `service_uptime_hourly`
 * checks into UTC days. Days without any checks come back with `uptimePct: null`.
 *
 * Incident count per day is NOT joined here — callers that want it merge in
 * `listIncidents()` results to keep the SQL focused on the aggregation hot path.
 */
export async function getDailyUptimeBars(
  db: DB,
  slug: string,
  days = 90,
  opts: DailyUptimeOptions = {},
): Promise<DailyUptimePoint[]> {
  const now = opts.now ?? new Date();
  const today = startOfUtcDay(now);
  const start = new Date(today.getTime() - (days - 1) * MS_PER_DAY);
  // Include the full current day by querying through the next midnight.
  const end = new Date(today.getTime() + MS_PER_DAY);

  const rows = await db
    .select()
    .from(serviceUptimeHourly)
    .where(
      and(
        eq(serviceUptimeHourly.serviceSlug, slug),
        gte(serviceUptimeHourly.hour, start),
        lte(serviceUptimeHourly.hour, end),
      ),
    )
    .orderBy(asc(serviceUptimeHourly.hour));

  type Bucket = { totalChecks: number; failedChecks: number };
  const buckets = new Map<number, Bucket>();
  for (const row of rows) {
    const bucketKey = startOfUtcDay(row.hour).getTime();
    const bucket = buckets.get(bucketKey) ?? { totalChecks: 0, failedChecks: 0 };
    bucket.totalChecks += row.totalChecks;
    bucket.failedChecks += row.failedChecks;
    buckets.set(bucketKey, bucket);
  }

  const out: DailyUptimePoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = new Date(start.getTime() + i * MS_PER_DAY);
    const bucket = buckets.get(dayStart.getTime());
    const uptimePct =
      bucket && bucket.totalChecks > 0
        ? ((bucket.totalChecks - bucket.failedChecks) / bucket.totalChecks) * 100
        : null;
    out.push({ date: dayStart, uptimePct, incidentCount: 0 });
  }
  return out;
}

/**
 * Year-to-date uptime summary, computed from `service_uptime_hourly` rows whose
 * `hour` lies in [Jan 1 UTC of `now`'s year, `now`].
 */
export async function getYearToDateSummary(
  db: DB,
  slug: string,
  opts: DailyUptimeOptions = {},
): Promise<YearToDateSummary> {
  const now = opts.now ?? new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));

  const [agg] = await db
    .select({
      totalChecks: sum(serviceUptimeHourly.totalChecks).mapWith(Number),
      failedChecks: sum(serviceUptimeHourly.failedChecks).mapWith(Number),
    })
    .from(serviceUptimeHourly)
    .where(
      and(
        eq(serviceUptimeHourly.serviceSlug, slug),
        gte(serviceUptimeHourly.hour, start),
        lte(serviceUptimeHourly.hour, now),
      ),
    );

  const totalChecks = agg?.totalChecks ?? 0;
  const failedChecks = agg?.failedChecks ?? 0;
  const uptimePct = totalChecks > 0 ? ((totalChecks - failedChecks) / totalChecks) * 100 : null;
  return { uptimePct, totalChecks, failedChecks };
}

/**
 * Returns hourly latency samples bucketed by window, suitable for feeding into
 * `<LatencyChart windows={...}>`. p95 is null because the schema only stores
 * `avg_latency_ms`; populate when quantiles land.
 */
export async function getLatencyByWindow(
  db: DB,
  slug: string,
  opts: DailyUptimeOptions = {},
): Promise<Record<LatencyWindowKey, LatencySamplePoint[]>> {
  const now = opts.now ?? new Date();
  const earliest = new Date(now.getTime() - WINDOW_HOURS["90d"] * MS_PER_HOUR);

  const rows = await db
    .select()
    .from(serviceUptimeHourly)
    .where(
      and(
        eq(serviceUptimeHourly.serviceSlug, slug),
        between(serviceUptimeHourly.hour, earliest, now),
      ),
    )
    .orderBy(asc(serviceUptimeHourly.hour));

  const byWindow: Record<LatencyWindowKey, LatencySamplePoint[]> = {
    "1d": [],
    "7d": [],
    "30d": [],
    "90d": [],
  };
  for (const row of rows) {
    const sample: LatencySamplePoint = {
      timestamp: row.hour,
      p50: row.avgLatencyMs,
      p95: null,
    };
    const ageMs = now.getTime() - row.hour.getTime();
    for (const key of Object.keys(WINDOW_HOURS) as LatencyWindowKey[]) {
      if (ageMs <= WINDOW_HOURS[key] * MS_PER_HOUR) {
        byWindow[key].push(sample);
      }
    }
  }
  return byWindow;
}
