import type { z } from "zod";
import { decodeCursor, encodeCursor, InvalidCursorError } from "@/lib/api/cursor";
import { toIncidentItem } from "@/lib/api/mappers";
import { apiError, publicJson, zodValidationError } from "@/lib/api/responses";
import { IncidentsQueryParams, type IncidentsResponse, parseSearchParams } from "@/lib/api/schemas";
import { db as defaultDb } from "@/lib/db";
import { withHttpMetrics } from "@/lib/metrics";
import { listIncidents } from "@/lib/queries/incidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/v1/incidents";

/**
 * GET /api/v1/incidents?service&from&to&severity&status&cursor&limit
 *
 * Cursor is offset-based and assumes the same (service, from, to, severity,
 * status) tuple as the originating request. Using a cursor with different
 * filters is undefined; we don't validate the tuple against the cursor.
 */
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  let query: z.infer<typeof IncidentsQueryParams>;
  try {
    query = parseSearchParams(IncidentsQueryParams, url.searchParams);
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

  const limit = query.limit;
  const rows = await listIncidents(defaultDb, {
    serviceSlug: query.service,
    status: query.status,
    severity: query.severity,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    offset,
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const body: IncidentsResponse = {
    data: page.map(toIncidentItem),
    ...(hasMore ? { next_cursor: encodeCursor({ offset: offset + limit }) } : {}),
  };

  return publicJson(body);
}

export const GET = withHttpMetrics(handler, ROUTE);
