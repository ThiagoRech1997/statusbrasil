import { Slug } from "@/lib/api/schemas";
import { formatBadgeValue, renderBadge, uptimePctToColor } from "@/lib/badge/render";
import { db as defaultDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withHttpMetrics } from "@/lib/metrics";
import { getServiceWithStatusBySlug } from "@/lib/queries/services";
import { getRolling30dSummary } from "@/lib/queries/uptime";
import { getRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/badge/[slug]/v1.svg";
const BADGE_LABEL = "uptime";
// Hotlinked <img> tags bypass any Next.js CDN headers we'd set on the route,
// so the cache contract lives in this header alone — browsers and intermediate
// caches (Cloudflare, GitHub camo) MUST honor `immutable` for the v1 schema.
const IMMUTABLE_CACHE = "public, max-age=86400, immutable";

const rateLimit = () => getRateLimiter("badge", { requests: 60, window: "1 m" });

function svgResponse(svg: string, status: number, cacheable: boolean): Response {
  return new Response(svg, {
    status,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": cacheable ? IMMUTABLE_CACHE : "no-store",
    },
  });
}

async function handler(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit().limit(ip);
  if (!rl.success) {
    return svgResponse(
      renderBadge({ label: BADGE_LABEL, value: "rate limited", color: "lightgrey" }),
      429,
      false,
    );
  }

  const { slug: rawSlug } = await ctx.params;
  const slugParse = Slug.safeParse(rawSlug);
  if (!slugParse.success) {
    return svgResponse(
      renderBadge({ label: BADGE_LABEL, value: "invalid slug", color: "lightgrey" }),
      400,
      false,
    );
  }
  const slug = slugParse.data;

  let uptimePct: number | null;
  try {
    const service = await getServiceWithStatusBySlug(defaultDb, slug);
    if (!service) {
      return svgResponse(
        renderBadge({ label: BADGE_LABEL, value: "unknown", color: "lightgrey" }),
        404,
        false,
      );
    }
    const summary = await getRolling30dSummary(defaultDb, slug);
    uptimePct = summary.uptimePct;
  } catch (err) {
    logger.error(
      { slug, error: err instanceof Error ? err.message : String(err) },
      "badge: query failed",
    );
    return svgResponse(
      renderBadge({ label: BADGE_LABEL, value: "error", color: "lightgrey" }),
      500,
      false,
    );
  }

  const value = formatBadgeValue(uptimePct);
  const color = uptimePctToColor(uptimePct);
  return svgResponse(renderBadge({ label: BADGE_LABEL, value, color }), 200, true);
}

export const GET = withHttpMetrics(handler, ROUTE);
