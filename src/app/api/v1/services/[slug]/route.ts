import { toIncidentItem, toServiceItem } from "@/lib/api/mappers";
import { apiError, publicJson, zodValidationError } from "@/lib/api/responses";
import { type ServiceDetailResponse, Slug } from "@/lib/api/schemas";
import { db as defaultDb } from "@/lib/db";
import { withHttpMetrics } from "@/lib/metrics";
import { getRecentByService } from "@/lib/queries/incidents";
import { getServiceWithStatusBySlug } from "@/lib/queries/services";
import { getRolling30dSummary } from "@/lib/queries/uptime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/v1/services/[slug]";

async function handler(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug: rawSlug } = await ctx.params;

  const slugParse = Slug.safeParse(rawSlug);
  if (!slugParse.success) {
    return zodValidationError(slugParse.error, "invalid slug");
  }
  const slug = slugParse.data;

  const service = await getServiceWithStatusBySlug(defaultDb, slug);
  if (!service) {
    return apiError(404, "not_found", `service '${slug}' not found`);
  }

  const [summary, recent] = await Promise.all([
    getRolling30dSummary(defaultDb, slug),
    getRecentByService(defaultDb, slug, 1),
  ]);

  const body: ServiceDetailResponse = {
    service: toServiceItem(service),
    uptime_pct_30d: summary.uptimePct,
    mttr_30d_seconds: summary.mttrSeconds,
    last_incident: recent[0] ? toIncidentItem(recent[0]) : null,
  };

  return publicJson(body);
}

export const GET = withHttpMetrics(handler, ROUTE);
