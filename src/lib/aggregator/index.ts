import "server-only";

import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { db as defaultDb } from "@/lib/db";
import { incidents, services, serviceUptimeHourly } from "@/lib/db/schema";
import { getGatusClient } from "@/lib/gatus";
import type { GatusClient } from "@/lib/gatus/client";
import type { EndpointResult } from "@/lib/gatus/schemas";
import { logger } from "@/lib/logger";

type TxClient = Parameters<Parameters<DB["transaction"]>[0]>[0];
type DbOrTx = DB | TxClient;

const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const NS_PER_MS = 1_000_000;
const DEFAULT_HOURS = 2;
const MAX_HOURS = 24 * 7;

export interface AggregateOptions {
  hours?: number;
  now?: Date;
  db?: DB;
  client?: GatusClient;
}

export interface AggregateSummary {
  servicesProcessed: number;
  hoursAggregated: number;
  incidentsOpened: number;
  incidentsClosed: number;
  durationMs: number;
}

export function resolveHours(raw: string | null | undefined): number {
  if (raw == null || raw === "") return DEFAULT_HOURS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid hours: ${raw}`);
  }
  if (parsed > MAX_HOURS) {
    throw new Error(`hours exceeds max ${MAX_HOURS}: ${parsed}`);
  }
  return parsed;
}

export async function runAggregation(opts: AggregateOptions = {}): Promise<AggregateSummary> {
  const start = Date.now();
  const hours = opts.hours ?? DEFAULT_HOURS;
  const now = opts.now ?? new Date();
  const database = opts.db ?? defaultDb;
  const client = opts.client ?? getGatusClient();

  const windowStart = new Date(truncateToHour(now.getTime()) - hours * MS_PER_HOUR);

  const [endpointStatuses, knownServices] = await Promise.all([
    client.listEndpointStatuses(),
    database.select({ slug: services.slug }).from(services),
  ]);
  const knownSlugs = new Set(knownServices.map((s) => s.slug));

  let servicesProcessed = 0;
  let hoursAggregated = 0;
  let incidentsOpened = 0;
  let incidentsClosed = 0;

  for (const status of endpointStatuses) {
    if (!knownSlugs.has(status.key)) {
      logger.warn(
        { key: status.key, name: status.name },
        "aggregate: gatus endpoint key has no matching service slug",
      );
      continue;
    }

    const slug = status.key;
    const inWindow = status.results.filter((r) => {
      const ts = Date.parse(r.timestamp);
      return Number.isFinite(ts) && ts >= windowStart.getTime() && ts <= now.getTime();
    });

    const perService = await aggregateService({
      db: database,
      slug,
      results: inWindow,
      windowStart,
    });

    servicesProcessed += 1;
    hoursAggregated += perService.hoursAggregated;
    incidentsOpened += perService.incidentsOpened;
    incidentsClosed += perService.incidentsClosed;
  }

  return {
    servicesProcessed,
    hoursAggregated,
    incidentsOpened,
    incidentsClosed,
    durationMs: Date.now() - start,
  };
}

interface PerServiceResult {
  hoursAggregated: number;
  incidentsOpened: number;
  incidentsClosed: number;
}

interface AggregateServiceArgs {
  db: DB;
  slug: string;
  results: EndpointResult[];
  windowStart: Date;
}

async function aggregateService(args: AggregateServiceArgs): Promise<PerServiceResult> {
  const { db, slug, results, windowStart } = args;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.serviceSlug, slug),
          or(gte(incidents.startedAt, windowStart), isNull(incidents.endedAt)),
        ),
      )
      .orderBy(desc(incidents.startedAt));

    const openIncident = existing.find((i) => i.endedAt === null) ?? null;

    const buckets = bucketByHour(results);
    // Seed the transition walker from the open incident (if any) so that an
    // ongoing failure that started before the window does not get duplicated
    // when its `started_at` is older than `windowStart`.
    const transitions = computeTransitions(
      results,
      openIncident
        ? {
            startedAt: openIncident.startedAt,
            statusCode: openIncident.statusCode,
            errorMessage: openIncident.errorMessage,
          }
        : undefined,
    );

    let hoursAggregated = 0;
    for (const [hourMs, bucket] of buckets) {
      await upsertHourly(tx, slug, new Date(hourMs), bucket);
      hoursAggregated += 1;
    }

    const { opened, closed } = await reconcileIncidents(tx, slug, transitions, existing);

    return { hoursAggregated, incidentsOpened: opened, incidentsClosed: closed };
  });
}

export interface HourBucket {
  total: number;
  failed: number;
  totalLatencyMs: number;
}

export function bucketByHour(results: EndpointResult[]): Map<number, HourBucket> {
  const buckets = new Map<number, HourBucket>();
  for (const r of results) {
    const ts = Date.parse(r.timestamp);
    if (!Number.isFinite(ts)) continue;
    const hourMs = truncateToHour(ts);
    const bucket = buckets.get(hourMs) ?? { total: 0, failed: 0, totalLatencyMs: 0 };
    bucket.total += 1;
    if (!r.success) bucket.failed += 1;
    bucket.totalLatencyMs += r.duration / NS_PER_MS;
    buckets.set(hourMs, bucket);
  }
  return buckets;
}

async function upsertHourly(
  tx: DbOrTx,
  slug: string,
  hour: Date,
  bucket: HourBucket,
): Promise<void> {
  const successful = bucket.total - bucket.failed;
  const uptimePct = bucket.total === 0 ? 0 : (successful / bucket.total) * 100;
  const avgLatencyMs = bucket.total === 0 ? 0 : Math.round(bucket.totalLatencyMs / bucket.total);

  await tx
    .insert(serviceUptimeHourly)
    .values({
      serviceSlug: slug,
      hour,
      uptimePct: uptimePct.toFixed(2),
      avgLatencyMs,
      totalChecks: bucket.total,
      failedChecks: bucket.failed,
    })
    .onConflictDoUpdate({
      target: [serviceUptimeHourly.serviceSlug, serviceUptimeHourly.hour],
      set: {
        uptimePct: uptimePct.toFixed(2),
        avgLatencyMs,
        totalChecks: bucket.total,
        failedChecks: bucket.failed,
      },
    });
}

export interface IncidentTransition {
  startedAt: Date;
  endedAt: Date | null;
  statusCode: number | null;
  errorMessage: string | null;
}

export interface InitialOpenIncident {
  startedAt: Date;
  statusCode: number | null;
  errorMessage: string | null;
}

export function computeTransitions(
  results: EndpointResult[],
  initialOpen?: InitialOpenIncident,
): IncidentTransition[] {
  const sorted = [...results].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const transitions: IncidentTransition[] = [];
  let runStart: { ts: Date; statusCode: number | null; errorMessage: string | null } | null =
    initialOpen
      ? {
          ts: initialOpen.startedAt,
          statusCode: initialOpen.statusCode,
          errorMessage: initialOpen.errorMessage,
        }
      : null;
  let prevSuccess: boolean | null = initialOpen ? false : null;

  for (const r of sorted) {
    const ts = new Date(r.timestamp);
    if (!r.success) {
      if (prevSuccess !== false) {
        runStart = {
          ts,
          statusCode: r.status ?? null,
          errorMessage: r.errors[0] ?? null,
        };
      }
    } else if (prevSuccess === false && runStart !== null) {
      transitions.push({
        startedAt: runStart.ts,
        endedAt: ts,
        statusCode: runStart.statusCode,
        errorMessage: runStart.errorMessage,
      });
      runStart = null;
    }
    prevSuccess = r.success;
  }

  if (runStart !== null) {
    transitions.push({
      startedAt: runStart.ts,
      endedAt: null,
      statusCode: runStart.statusCode,
      errorMessage: runStart.errorMessage,
    });
  }

  return transitions;
}

type ExistingIncident = typeof incidents.$inferSelect;

async function reconcileIncidents(
  tx: DbOrTx,
  slug: string,
  transitions: IncidentTransition[],
  existing: ExistingIncident[],
): Promise<{ opened: number; closed: number }> {
  const byStart = new Map(existing.map((i) => [i.startedAt.toISOString(), i]));
  const openIncident = existing.find((i) => i.endedAt === null) ?? null;

  let opened = 0;
  let closed = 0;

  for (const t of transitions) {
    const startKey = t.startedAt.toISOString();
    const existingRow = byStart.get(startKey);

    if (!existingRow) {
      if (openIncident && openIncident.startedAt.getTime() < t.startedAt.getTime() && t.endedAt) {
        // Defensive: we computed a new transition while DB still has an open incident
        // started earlier. Close the older open incident at our transition start.
        await closeIncident(tx, openIncident.id, t.startedAt);
        closed += 1;
      }

      const durationSeconds = t.endedAt
        ? Math.max(0, Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / MS_PER_SECOND))
        : null;
      await tx.insert(incidents).values({
        serviceSlug: slug,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        durationSeconds,
        statusCode: t.statusCode,
        errorMessage: t.errorMessage,
        severity: "partial",
      });
      opened += 1;
      if (t.endedAt) closed += 1;
      continue;
    }

    if (t.endedAt && existingRow.endedAt === null) {
      await closeIncident(tx, existingRow.id, t.endedAt);
      closed += 1;
    }
    // else: already in correct state — idempotent no-op
  }

  return { opened, closed };
}

async function closeIncident(tx: DbOrTx, id: string, endedAt: Date): Promise<void> {
  const [row] = await tx
    .select({ startedAt: incidents.startedAt })
    .from(incidents)
    .where(eq(incidents.id, id))
    .limit(1);
  if (!row) return;
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - row.startedAt.getTime()) / MS_PER_SECOND),
  );
  await tx.update(incidents).set({ endedAt, durationSeconds }).where(eq(incidents.id, id));
}

function truncateToHour(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0);
}
