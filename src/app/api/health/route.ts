import { NextResponse } from "next/server";
import { withHttpMetrics } from "@/lib/metrics";
import { version } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handler(): Response {
  return NextResponse.json({
    status: "ok",
    version,
    uptime: Math.floor(process.uptime()),
  });
}

export const GET = withHttpMetrics(handler, "/api/health");
