import "server-only";

import { Counter, collectDefaultMetrics, Histogram, Registry } from "prom-client";

export type CronOutcome = "success" | "fail";
export type GatusOutcome = "success" | "error";

interface MetricsBundle {
  registry: Registry;
  httpRequestDuration: Histogram<"method" | "route" | "status">;
  gatusRequestsTotal: Counter<"path" | "outcome">;
  cronRunsTotal: Counter<"job" | "outcome">;
}

declare global {
  var __sbMetrics: MetricsBundle | undefined;
}

const HTTP_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

function build(): MetricsBundle {
  const registry = new Registry();
  registry.setDefaultLabels({ app: "statusbrasil" });
  collectDefaultMetrics({ register: registry });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests handled by Next.js route handlers, in seconds.",
    labelNames: ["method", "route", "status"] as const,
    buckets: [...HTTP_BUCKETS_SECONDS],
    registers: [registry],
  });

  const gatusRequestsTotal = new Counter({
    name: "gatus_requests_total",
    help: "Number of HTTP requests issued to Gatus, by path and outcome (success or error).",
    labelNames: ["path", "outcome"] as const,
    registers: [registry],
  });

  const cronRunsTotal = new Counter({
    name: "cron_runs_total",
    help: "Number of cron job executions, by job name and outcome (success or fail).",
    labelNames: ["job", "outcome"] as const,
    registers: [registry],
  });

  return { registry, httpRequestDuration, gatusRequestsTotal, cronRunsTotal };
}

function metrics(): MetricsBundle {
  if (!globalThis.__sbMetrics) globalThis.__sbMetrics = build();
  return globalThis.__sbMetrics;
}

export function getRegistry(): Registry {
  return metrics().registry;
}

export async function renderMetrics(): Promise<{ contentType: string; body: string }> {
  const { registry } = metrics();
  return { contentType: registry.contentType, body: await registry.metrics() };
}

export function observeHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number,
): void {
  metrics().httpRequestDuration.observe({ method, route, status: String(status) }, durationSeconds);
}

export function incGatusRequest(path: string, outcome: GatusOutcome): void {
  metrics().gatusRequestsTotal.inc({ path, outcome });
}

export function incCronRun(job: string, outcome: CronOutcome): void {
  metrics().cronRunsTotal.inc({ job, outcome });
}

export function withHttpMetrics<TArgs extends unknown[]>(
  handler: (req: Request, ...rest: TArgs) => Promise<Response> | Response,
  route: string,
): (req: Request, ...rest: TArgs) => Promise<Response> {
  return async (req: Request, ...rest: TArgs) => {
    const start = performance.now();
    let status = 500;
    try {
      const res = await handler(req, ...rest);
      status = res.status;
      return res;
    } finally {
      const duration = (performance.now() - start) / 1000;
      observeHttpRequest(req.method, route, status, duration);
    }
  };
}
