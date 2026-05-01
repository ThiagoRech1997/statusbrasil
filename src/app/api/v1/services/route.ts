import type { z } from "zod";
import { decodeCursor, encodeCursor, InvalidCursorError } from "@/lib/api/cursor";
import { toServiceItem } from "@/lib/api/mappers";
import { apiError, publicJson, zodValidationError } from "@/lib/api/responses";
import {
  parseSearchParams,
  ServicesQueryParams,
  type ServicesResponse,
  type ServicesSort,
} from "@/lib/api/schemas";
import { db as defaultDb } from "@/lib/db";
import { withHttpMetrics } from "@/lib/metrics";
import {
  type CurrentStatus,
  getServicesByCategoryStatus,
  type ServiceWithStatus,
} from "@/lib/queries/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/v1/services";

const SEVERITY_RANK: Record<CurrentStatus, number> = {
  down: 0,
  degraded: 1,
  operational: 2,
  unknown: 3,
};

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  let query: z.infer<typeof ServicesQueryParams>;
  try {
    query = parseSearchParams(ServicesQueryParams, url.searchParams);
  } catch (err) {
    return zodValidationError(err);
  }

  let offset = 0;
  if (query.cursor) {
    try {
      offset = decodeCursor(query.cursor).offset;
    } catch (err) {
      const detail = err instanceof InvalidCursorError ? err.message : "invalid cursor";
      return apiError(400, "validation_error", "invalid cursor", { cursor: [detail] });
    }
  }

  const groups = await getServicesByCategoryStatus(defaultDb);
  const flat = groups.flatMap((g) => g.services);

  const filtered = flat.filter((s) => {
    if (query.category && s.category !== query.category) return false;
    if (query.status && s.status !== query.status) return false;
    return true;
  });

  filtered.sort(comparator(query.sort));

  const page = filtered.slice(offset, offset + query.limit);
  const hasMore = offset + page.length < filtered.length;

  const body: ServicesResponse = {
    data: page.map(toServiceItem),
    ...(hasMore ? { next_cursor: encodeCursor({ offset: offset + page.length }) } : {}),
  };

  return publicJson(body);
}

function comparator(sort: ServicesSort): (a: ServiceWithStatus, b: ServiceWithStatus) => number {
  switch (sort) {
    case "category":
      return (a, b) => byString(a.category, b.category) || byString(a.name, b.name);
    case "status":
      return (a, b) =>
        SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || byString(a.name, b.name);
    case "uptime":
      return (a, b) => {
        if (a.uptime1h === null && b.uptime1h === null) return byString(a.name, b.name);
        if (a.uptime1h === null) return 1;
        if (b.uptime1h === null) return -1;
        if (a.uptime1h !== b.uptime1h) return b.uptime1h - a.uptime1h;
        return byString(a.name, b.name);
      };
    default:
      return (a, b) => byString(a.name, b.name);
  }
}

function byString(a: string, b: string): number {
  return a.localeCompare(b);
}

export const GET = withHttpMetrics(handler, ROUTE);
