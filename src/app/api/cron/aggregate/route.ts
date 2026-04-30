import { NextResponse } from "next/server";
import { resolveHours, runAggregation } from "@/lib/aggregator";
import { logger } from "@/lib/logger";
import { getRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rateLimit = () => getRateLimiter("cron-aggregate", { requests: 6, window: "1 m" });

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!expected) {
    logger.error("cron/aggregate: CRON_SECRET is not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (provided !== expected) {
    const rl = await rateLimit().limit(`bad-secret:${ip}`);
    if (!rl.success) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    logger.warn({ ip }, "cron/aggregate: secret mismatch");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let hours: number;
  try {
    const url = new URL(req.url);
    hours = resolveHours(url.searchParams.get("hours"));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid hours" },
      { status: 400 },
    );
  }

  try {
    const summary = await runAggregation({ hours });
    logger.info({ ...summary, hours }, "cron/aggregate: completed");
    return NextResponse.json({
      services_processed: summary.servicesProcessed,
      hours_aggregated: summary.hoursAggregated,
      incidents_opened: summary.incidentsOpened,
      incidents_closed: summary.incidentsClosed,
      duration_ms: summary.durationMs,
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "cron/aggregate: failed",
    );
    return NextResponse.json({ error: "aggregation failed" }, { status: 500 });
  }
}
