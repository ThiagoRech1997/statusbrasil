import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { renderMetrics } from "@/lib/metrics";
import { getRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rateLimit = () => getRateLimiter("metrics", { requests: 10, window: "1 m" });

const BEARER_PREFIX = "Bearer ";

export async function GET(req: Request): Promise<Response> {
  const expected = process.env.METRICS_SECRET;
  if (!expected) {
    logger.error("metrics: METRICS_SECRET is not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const provided = authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length).trim()
    : "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (provided !== expected) {
    const rl = await rateLimit().limit(`bad-secret:${ip}`);
    if (!rl.success) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    logger.warn({ ip }, "metrics: bearer mismatch");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { contentType, body } = await renderMetrics();
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "no-store" },
  });
}
