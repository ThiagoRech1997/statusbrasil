import { generateOpenApiSpec } from "@/lib/api/openapi";
import { withHttpMetrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/openapi.json";
const CACHE_CONTROL = "s-maxage=3600, stale-while-revalidate=7200";

async function handler(): Promise<Response> {
  const spec = generateOpenApiSpec();
  return new Response(JSON.stringify(spec), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
}

export const GET = withHttpMetrics(handler, ROUTE);
