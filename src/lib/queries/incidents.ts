import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lte, type SQL } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { incidents } from "@/lib/db/schema";

export type IncidentSeverity = "partial" | "total";
export type IncidentStatus = "open" | "closed";

export interface IncidentRow {
  id: string;
  serviceSlug: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  severity: IncidentSeverity;
}

export interface IncidentFilters {
  serviceSlug?: string;
  status?: IncidentStatus | "all";
  severity?: IncidentSeverity;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function listIncidents(db: DB, filters: IncidentFilters = {}): Promise<IncidentRow[]> {
  const conditions: SQL[] = [];
  if (filters.serviceSlug) conditions.push(eq(incidents.serviceSlug, filters.serviceSlug));
  if (filters.severity) conditions.push(eq(incidents.severity, filters.severity));
  if (filters.status === "open") conditions.push(isNull(incidents.endedAt));
  else if (filters.status === "closed") conditions.push(isNotNull(incidents.endedAt));
  if (filters.from) conditions.push(gte(incidents.startedAt, filters.from));
  if (filters.to) conditions.push(lte(incidents.startedAt, filters.to));

  const limit = clampLimit(filters.limit);
  const offset = Math.max(0, filters.offset ?? 0);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(incidents)
    .where(where)
    .orderBy(desc(incidents.startedAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function getIncident(db: DB, id: string): Promise<IncidentRow | null> {
  const [row] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  return row ?? null;
}

export async function getRecentByService(db: DB, slug: string, limit = 10): Promise<IncidentRow[]> {
  return db
    .select()
    .from(incidents)
    .where(eq(incidents.serviceSlug, slug))
    .orderBy(desc(incidents.startedAt))
    .limit(clampLimit(limit));
}

function clampLimit(raw: number | undefined): number {
  if (raw == null) return DEFAULT_LIMIT;
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}
