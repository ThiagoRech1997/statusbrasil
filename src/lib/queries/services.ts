import "server-only";

import { asc, desc, eq, gte, isNull } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { incidents, services, serviceUptimeHourly } from "@/lib/db/schema";

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
    const open = openBySlug.get(svc.slug);
    const uptime1h = latest ? Number(latest.uptimePct) : null;

    let status: CurrentStatus;
    if (open) {
      status = open.severity === "total" ? "down" : "degraded";
    } else if (uptime1h === null) {
      status = "unknown";
    } else if (uptime1h < DOWN_THRESHOLD_PCT) {
      status = "down";
    } else if (uptime1h < OPERATIONAL_THRESHOLD_PCT) {
      status = "degraded";
    } else {
      status = "operational";
    }

    const entry: ServiceWithStatus = { ...svc, status, uptime1h };
    const bucket = groups.get(svc.category);
    if (bucket) bucket.push(entry);
    else groups.set(svc.category, [entry]);
  }

  return [...groups.entries()].map(([category, list]) => ({ category, services: list }));
}
