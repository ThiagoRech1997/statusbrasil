import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, max, sum } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { incidents, services, serviceUptimeHourly } from "@/lib/db/schema";
import type { IncidentSeverity } from "./incidents";

export type CurrentStatus = "operational" | "degraded" | "down" | "unknown";

export interface ServiceRow {
  slug: string;
  name: string;
  agency: string;
  category: string;
  sphere: "federal" | "estadual" | "municipal";
  url: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
}

export interface ServiceWithStatus extends ServiceRow {
  status: CurrentStatus;
  uptime1h: number | null;
}

export interface CategoryGroup {
  category: string;
  services: ServiceWithStatus[];
}

export interface ListServicesOptions {
  activeOnly?: boolean;
}

export async function listServices(db: DB, opts: ListServicesOptions = {}): Promise<ServiceRow[]> {
  const base = db.select().from(services);
  const rows = opts.activeOnly
    ? await base.where(eq(services.active, true)).orderBy(asc(services.name))
    : await base.orderBy(asc(services.name));
  return rows;
}

export async function getServiceBySlug(db: DB, slug: string): Promise<ServiceRow | null> {
  const [row] = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  return row ?? null;
}

const FRESH_WINDOW_MS = 2 * 60 * 60 * 1000;
const OPERATIONAL_THRESHOLD_PCT = 99;
const DOWN_THRESHOLD_PCT = 50;

export interface CategoryStatusOptions {
  now?: Date;
}

export function deriveCurrentStatus(args: {
  uptime1h: number | null;
  openIncident: { severity: IncidentSeverity } | null;
}): CurrentStatus {
  if (args.openIncident) {
    return args.openIncident.severity === "total" ? "down" : "degraded";
  }
  if (args.uptime1h === null) return "unknown";
  if (args.uptime1h < DOWN_THRESHOLD_PCT) return "down";
  if (args.uptime1h < OPERATIONAL_THRESHOLD_PCT) return "degraded";
  return "operational";
}

export async function getServicesByCategoryStatus(
  db: DB,
  opts: CategoryStatusOptions = {},
): Promise<CategoryGroup[]> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - FRESH_WINDOW_MS);

  const [activeServices, recentHourly, openIncidents] = await Promise.all([
    db
      .select()
      .from(services)
      .where(eq(services.active, true))
      .orderBy(asc(services.category), asc(services.name)),
    db
      .select()
      .from(serviceUptimeHourly)
      .where(gte(serviceUptimeHourly.hour, cutoff))
      .orderBy(desc(serviceUptimeHourly.hour)),
    db.select().from(incidents).where(isNull(incidents.endedAt)),
  ]);

  const latestHourlyBySlug = new Map<string, (typeof recentHourly)[number]>();
  for (const row of recentHourly) {
    if (!latestHourlyBySlug.has(row.serviceSlug)) latestHourlyBySlug.set(row.serviceSlug, row);
  }

  const openBySlug = new Map<string, (typeof openIncidents)[number]>();
  for (const inc of openIncidents) {
    const prev = openBySlug.get(inc.serviceSlug);
    if (!prev || (inc.severity === "total" && prev.severity !== "total")) {
      openBySlug.set(inc.serviceSlug, inc);
    }
  }

  const groups = new Map<string, ServiceWithStatus[]>();
  for (const svc of activeServices) {
    const latest = latestHourlyBySlug.get(svc.slug);
    const open = openBySlug.get(svc.slug) ?? null;
    const uptime1h = latest ? Number(latest.uptimePct) : null;
    const status = deriveCurrentStatus({ uptime1h, openIncident: open });

    const entry: ServiceWithStatus = { ...svc, status, uptime1h };
    const bucket = groups.get(svc.category);
    if (bucket) bucket.push(entry);
    else groups.set(svc.category, [entry]);
  }

  return [...groups.entries()].map(([category, list]) => ({ category, services: list }));
}

export interface ServiceWithStatusOptions {
  now?: Date;
}

export interface ServiceCardRow extends ServiceWithStatus {
  uptime24hPct: number | null;
  uptime7dPct: number | null;
  lastIncidentAt: Date | null;
}

export interface HomeCategoryGroup {
  category: string;
  services: ServiceCardRow[];
}

const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 60 * 60 * 1000;
const ONE_DAY_MS = HOURS_PER_DAY * MS_PER_HOUR;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

async function aggregateUptimeBySlug(
  db: DB,
  slugs: string[],
  since: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      serviceSlug: serviceUptimeHourly.serviceSlug,
      totalChecks: sum(serviceUptimeHourly.totalChecks).mapWith(Number),
      failedChecks: sum(serviceUptimeHourly.failedChecks).mapWith(Number),
    })
    .from(serviceUptimeHourly)
    .where(
      and(inArray(serviceUptimeHourly.serviceSlug, slugs), gte(serviceUptimeHourly.hour, since)),
    )
    .groupBy(serviceUptimeHourly.serviceSlug);

  const out = new Map<string, number>();
  for (const row of rows) {
    const total = row.totalChecks ?? 0;
    if (total === 0) continue;
    const failed = row.failedChecks ?? 0;
    out.set(row.serviceSlug, ((total - failed) / total) * 100);
  }
  return out;
}

/**
 * Home dashboard composition: groups by category and enriches each row with
 * 24-hour uptime, 7-day uptime, and the most recent incident timestamp.
 * Computed via three batched aggregate queries — never per-service. Use
 * exclusively from the home page; the public API endpoints stay on
 * getServicesByCategoryStatus so they don't pay for fields that are
 * stripped at the wire.
 */
export async function getHomeDashboard(
  db: DB,
  opts: CategoryStatusOptions = {},
): Promise<HomeCategoryGroup[]> {
  const now = opts.now ?? new Date();
  const groups = await getServicesByCategoryStatus(db, opts);
  const slugs = groups.flatMap((g) => g.services.map((s) => s.slug));

  if (slugs.length === 0) return [];

  const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  const [uptime24hBySlug, uptime7dBySlug, incidentRows] = await Promise.all([
    aggregateUptimeBySlug(db, slugs, oneDayAgo),
    aggregateUptimeBySlug(db, slugs, sevenDaysAgo),
    db
      .select({
        serviceSlug: incidents.serviceSlug,
        lastStartedAt: max(incidents.startedAt),
      })
      .from(incidents)
      .where(inArray(incidents.serviceSlug, slugs))
      .groupBy(incidents.serviceSlug),
  ]);

  const lastIncidentBySlug = new Map<string, Date>();
  for (const row of incidentRows) {
    if (row.lastStartedAt instanceof Date) {
      lastIncidentBySlug.set(row.serviceSlug, row.lastStartedAt);
    } else if (typeof row.lastStartedAt === "string") {
      lastIncidentBySlug.set(row.serviceSlug, new Date(row.lastStartedAt));
    }
  }

  return groups.map((group) => ({
    category: group.category,
    services: group.services.map((svc) => ({
      ...svc,
      uptime24hPct: uptime24hBySlug.get(svc.slug) ?? null,
      uptime7dPct: uptime7dBySlug.get(svc.slug) ?? null,
      lastIncidentAt: lastIncidentBySlug.get(svc.slug) ?? null,
    })),
  }));
}

export async function getServiceWithStatusBySlug(
  db: DB,
  slug: string,
  opts: ServiceWithStatusOptions = {},
): Promise<ServiceWithStatus | null> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - FRESH_WINDOW_MS);

  const [serviceRows, recentHourly, openIncidents] = await Promise.all([
    db.select().from(services).where(eq(services.slug, slug)).limit(1),
    db
      .select()
      .from(serviceUptimeHourly)
      .where(and(eq(serviceUptimeHourly.serviceSlug, slug), gte(serviceUptimeHourly.hour, cutoff)))
      .orderBy(desc(serviceUptimeHourly.hour))
      .limit(1),
    db
      .select()
      .from(incidents)
      .where(and(eq(incidents.serviceSlug, slug), isNull(incidents.endedAt))),
  ]);

  const svc = serviceRows[0];
  if (!svc) return null;

  const latest = recentHourly[0];
  const uptime1h = latest ? Number(latest.uptimePct) : null;
  const open = openIncidents.find((i) => i.severity === "total") ?? openIncidents[0] ?? null;
  const status = deriveCurrentStatus({ uptime1h, openIncident: open });

  return { ...svc, status, uptime1h };
}
