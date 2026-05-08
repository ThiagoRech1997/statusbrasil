import type { z } from "zod";
import { rateLimitedResponse, rateLimitGate } from "@/lib/api/rate-limit-gate";
import { zodValidationError } from "@/lib/api/responses";
import { parseSearchParams, ServicesQueryParams, Sphere } from "@/lib/api/schemas";
import { db as defaultDb } from "@/lib/db";
import { withHttpMetrics } from "@/lib/metrics";
import {
  type CurrentStatus,
  getServicesByCategoryStatus,
  type ServiceWithStatus,
} from "@/lib/queries/services";
import { getBatchRollingUptimeSummary } from "@/lib/queries/uptime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/v1/services.csv";

// CsvQueryParams reuses the same filters as ServicesQueryParams but without
// cursor/limit (the export always returns all matching rows) and adds sphere.
const CsvQueryParams = ServicesQueryParams.pick({
  sort: true,
  category: true,
  status: true,
}).extend({
  sphere: Sphere.optional(),
});

type CsvQueryParams = z.infer<typeof CsvQueryParams>;

const SEVERITY_RANK: Record<CurrentStatus, number> = {
  down: 0,
  degraded: 1,
  operational: 2,
  unknown: 3,
};

function comparator(sort: CsvQueryParams["sort"]) {
  return (a: ServiceWithStatus, b: ServiceWithStatus): number => {
    switch (sort) {
      case "category":
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      case "status":
        return SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || a.name.localeCompare(b.name);
      case "uptime":
        if (a.uptime1h === null && b.uptime1h === null) return a.name.localeCompare(b.name);
        if (a.uptime1h === null) return 1;
        if (b.uptime1h === null) return -1;
        if (a.uptime1h !== b.uptime1h) return b.uptime1h - a.uptime1h;
        return a.name.localeCompare(b.name);
      default:
        return a.name.localeCompare(b.name);
    }
  };
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function handler(req: Request): Promise<Response> {
  const gate = await rateLimitGate(req);
  if (!gate.allowed) return rateLimitedResponse(gate.retryAfterSeconds);

  const url = new URL(req.url);

  let query: CsvQueryParams;
  try {
    query = parseSearchParams(CsvQueryParams, url.searchParams);
  } catch (err) {
    return zodValidationError(err);
  }

  const groups = await getServicesByCategoryStatus(defaultDb);
  const flat = groups.flatMap((g) => g.services);

  const filtered = flat.filter((s) => {
    if (query.category && s.category !== query.category) return false;
    if (query.status && s.status !== query.status) return false;
    if (query.sphere && s.sphere !== query.sphere) return false;
    return true;
  });

  filtered.sort(comparator(query.sort));

  const slugs = filtered.map((s) => s.slug);
  const batchSummary = await getBatchRollingUptimeSummary(defaultDb, slugs);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const BOM = "﻿";
  const HEADER =
    "slug,name,agency,category,sphere,status,uptime_30d,uptime_90d,mttr_30d,last_incident_at";

  const rows = filtered.map((s) => {
    const summary = batchSummary.get(s.slug);
    const uptime30d = summary?.uptime30dPct != null ? summary.uptime30dPct.toFixed(2) : "";
    const uptime90d = summary?.uptime90dPct != null ? summary.uptime90dPct.toFixed(2) : "";
    const mttr30d = summary?.mttr30dSeconds != null ? String(summary.mttr30dSeconds) : "";
    const lastIncident = summary?.lastIncidentAt ? summary.lastIncidentAt.toISOString() : "";

    return [
      csvCell(s.slug),
      csvCell(s.name),
      csvCell(s.agency),
      csvCell(s.category),
      csvCell(s.sphere),
      csvCell(s.status),
      uptime30d,
      uptime90d,
      mttr30d,
      lastIncident,
    ].join(",");
  });

  const csv = [BOM + HEADER, ...rows].join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="statusbrasil-ranking-${dateStr}.csv"`,
      "cache-control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export const GET = withHttpMetrics(handler, ROUTE);
