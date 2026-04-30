import { NextResponse } from "next/server";
import { version } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version,
    uptime: Math.floor(process.uptime()),
  });
}
