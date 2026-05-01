import { toHourlyPoint } from "@/lib/api/mappers";
import {
  apiError,
  PUBLIC_CACHE_HEADER_300,
  publicJson,
  zodValidationError,
} from "@/lib/api/responses";
import {
  HistoryQueryParams,
  type HistoryResponse,
  parseSearchParams,
  Slug,
} from "@/lib/api/schemas";
import { db as defaultDb } from "@/lib/db";
import { withHttpMetrics } from "@/lib/metrics";
import { getServiceBySlug } from "@/lib/queries/services";
import { getHistoryHourly } from "@/lib/queries/uptime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/v1/services/[slug]/history";
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * GET /api/v1/services/[slug]/history?from&to
 *
 * Default range when neither query param is given: [now-24h, now].
 * Either from or to alone is permitted; the other side defaults to its
 * counterpart in the same window. Ranges greater than 90 days are
 * rejected with 400 ({error: "max range is 90d"}) per TFR-149 contract.
 */
async function handler(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug: rawSlug } = await ctx.params;

  const slugParse = Slug.safeParse(rawSlug);
  if (!slugParse.success) {
    return zodValidationError(slugParse.error, "invalid slug");
  }
  const slug = slugParse.data;

  const url = new URL(req.url);
  let parsed: { from?: string; to?: string };
  try {
    parsed = parseSearchParams(HistoryQueryParams, url.searchParams);
  } catch (err) {
    return zodValidationError(err);
  }

  const now = new Date();
  const to = parsed.to ? new Date(parsed.to) : now;
  const from = parsed.from ? new Date(parsed.from) : new Date(to.getTime() - DEFAULT_RANGE_MS);

  if (to.getTime() < from.getTime()) {
    return apiError(400, "validation_error", "to must be greater than or equal to from", {
      to: ["to must be greater than or equal to from"],
    });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return apiError(400, "validation_error", "max range is 90d", {
      range: ["max range is 90d"],
    });
  }

  const service = await getServiceBySlug(defaultDb, slug);
  if (!service) {
    return apiError(404, "not_found", `service '${slug}' not found`);
  }

  const points = await getHistoryHourly(defaultDb, slug, { from, to });

  const body: HistoryResponse = {
    slug,
    range: { from: from.toISOString(), to: to.toISOString() },
    points: points.map(toHourlyPoint),
  };

  return publicJson(body, { cacheControl: PUBLIC_CACHE_HEADER_300 });
}

export const GET = withHttpMetrics(handler, ROUTE);
