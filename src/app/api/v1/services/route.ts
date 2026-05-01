import { NextResponse } from "next/server";
import type { z } from "zod";
import { decodeCursor, encodeCursor, InvalidCursorError } from "@/lib/api/cursor";
import {
  type ApiErrorResponse,
  parseSearchParams,
  type ServiceItem,
  ServicesQueryParams,
  type ServicesResponse,
  type ServicesSort,
} from "@/lib/api/schemas";
import { db as defaultDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withHttpMetrics } from "@/lib/metrics";
import {
  type CurrentStatus,
  getServicesByCategoryStatus,
  type ServiceWithStatus,
} from "@/lib/queries/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/v1/services";
const CACHE_CONTROL = "s-maxage=60, stale-while-revalidate=300";

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
    return validationError(err);
  }

  let offset = 0;
  if (query.cursor) {
    try {
      offset = decodeCursor(query.cursor).offset;
    } catch (err) {
      const detail = err instanceof InvalidCursorError ? err.message : "invalid cursor";
      return errorResponse(400, "validation_error", "invalid cursor", { cursor: [detail] });
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

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
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

function toServiceItem(s: ServiceWithStatus): ServiceItem {
  return {
    slug: s.slug,
    name: s.name,
    agency: s.agency,
    category: s.category,
    sphere: s.sphere,
    url: s.url,
    description: s.description,
    status: s.status,
    uptime1h: s.uptime1h,
  };
}

function validationError(err: unknown): Response {
  const issues =
    err && typeof err === "object" && "issues" in err
      ? (err as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues
      : null;
  const details = issues
    ? issues.reduce<Record<string, string[]>>((acc, issue) => {
        const key = issue.path.length > 0 ? String(issue.path[0]) : "_";
        const list = acc[key] ?? [];
        list.push(issue.message);
        acc[key] = list;
        return acc;
      }, {})
    : undefined;
  logger.debug(
    { err: err instanceof Error ? err.message : String(err) },
    "services: invalid query",
  );
  return errorResponse(400, "validation_error", "invalid query parameters", details);
}

function errorResponse(
  status: number,
  code: ApiErrorResponse["code"],
  error: string,
  details?: unknown,
): Response {
  const body: ApiErrorResponse = { error, code, ...(details !== undefined ? { details } : {}) };
  return NextResponse.json(body, { status });
}

export const GET = withHttpMetrics(handler, ROUTE);
