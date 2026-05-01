import "server-only";

import { and, asc, between, count, eq, gte, inArray, isNull, lt, lte, or, sum } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { incidents, serviceUptimeHourly } from "@/lib/db/schema";

const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;

export interface HourlyPoint {
  hour: Date;
  uptimePct: number;
  avgLatencyMs: number;
  totalChecks: number;
  failedChecks: number;
}

export interface HistoryRange {
  from: Date;
  to: Date;
}

export async function getHistoryHourly(
  db: DB,
  slug: string,
  range: HistoryRange,
): Promise<HourlyPoint[]> {
  if (range.to.getTime() < range.from.getTime()) {
    throw new Error("getHistoryHourly: range.to must be >= range.from");
  }
  const rows = await db
    .select()
    .from(serviceUptimeHourly)
    .where(
      and(
        eq(serviceUptimeHourly.serviceSlug, slug),
        between(serviceUptimeHourly.hour, range.from, range.to),
      ),
    )
    .orderBy(asc(serviceUptimeHourly.hour));

  return rows.map((r) => ({
    hour: r.hour,
    uptimePct: Number(r.uptimePct),
    avgLatencyMs: r.avgLatencyMs,
    totalChecks: r.totalChecks,
    failedChecks: r.failedChecks,
  }));
}

export interface MonthSummary {
  month: Date;
  uptimePct: number | null;
  totalChecks: number;
  failedChecks: number;
  totalIncidents: number;
  totalDowntimeSeconds: number;
}

export function monthBoundsUTC(monthDate: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  return { start, end };
}

export async function getMonthSummary(
  db: DB,
  slug: string,
  monthDate: Date,
): Promise<MonthSummary> {
  const { start, end } = monthBoundsUTC(monthDate);

  const [hourlyAgg] = await db
    .select({
      totalChecks: sum(serviceUptimeHourly.totalChecks).mapWith(Number),
      failedChecks: sum(serviceUptimeHourly.failedChecks).mapWith(Number),
    })
    .from(serviceUptimeHourly)
    .where(
      and(
        eq(serviceUptimeHourly.serviceSlug, slug),
        gte(serviceUptimeHourly.hour, start),
        lt(serviceUptimeHourly.hour, end),
      ),
    );

  const [incidentAgg] = await db
    .select({
      totalIncidents: count(incidents.id),
      totalDowntimeSeconds: sum(incidents.durationSeconds).mapWith(Number),
    })
    .from(incidents)
    .where(
      and(
        eq(incidents.serviceSlug, slug),
        gte(incidents.startedAt, start),
        lt(incidents.startedAt, end),
      ),
    );

  const totalChecks = hourlyAgg?.totalChecks ?? 0;
  const failedChecks = hourlyAgg?.failedChecks ?? 0;
  const uptimePct = totalChecks > 0 ? ((totalChecks - failedChecks) / totalChecks) * 100 : null;

  return {
    month: start,
    uptimePct,
    totalChecks,
    failedChecks,
    totalIncidents: incidentAgg?.totalIncidents ?? 0,
    totalDowntimeSeconds: incidentAgg?.totalDowntimeSeconds ?? 0,
  };
}

export interface CumulativeDowntimeOptions {
  slugs?: string[];
  now?: Date;
}

export async function getCumulativeDowntime24h(
  db: DB,
  opts: CumulativeDowntimeOptions = {},
): Promise<Record<string, number>> {
  const now = opts.now ?? new Date();
  const windowStart = new Date(now.getTime() - HOURS_PER_DAY * MS_PER_HOUR);

  const filters = [
    or(gte(incidents.endedAt, windowStart), isNull(incidents.endedAt)),
    lte(incidents.startedAt, now),
  ];
  if (opts.slugs && opts.slugs.length > 0) {
    filters.push(inArray(incidents.serviceSlug, opts.slugs));
  }

  const rows = await db
    .select({
      serviceSlug: incidents.serviceSlug,
      startedAt: incidents.startedAt,
      endedAt: incidents.endedAt,
    })
    .from(incidents)
    .where(and(...filters));

  const result: Record<string, number> = {};
  for (const row of rows) {
    const startMs = Math.max(row.startedAt.getTime(), windowStart.getTime());
    const endMs = Math.min(row.endedAt?.getTime() ?? now.getTime(), now.getTime());
    const overlap = Math.max(0, endMs - startMs);
    if (overlap === 0) continue;
    result[row.serviceSlug] = (result[row.serviceSlug] ?? 0) + Math.round(overlap / MS_PER_SECOND);
  }

  if (opts.slugs) {
    for (const slug of opts.slugs) {
      if (!(slug in result)) result[slug] = 0;
    }
  }

  return result;
}
