import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getRegistry,
  incCronRun,
  incGatusRequest,
  observeHttpRequest,
  renderMetrics,
  withHttpMetrics,
} from "./metrics";

beforeEach(() => {
  getRegistry().resetMetrics();
});

afterAll(() => {
  getRegistry().resetMetrics();
});

describe("renderMetrics", () => {
  it("returns prometheus text content type and includes default node metrics", async () => {
    const { contentType, body } = await renderMetrics();
    expect(contentType).toMatch(/^text\/plain/);
    expect(body).toContain("process_cpu_user_seconds_total");
    expect(body).toContain("nodejs_version_info");
  });

  it("tags samples with the app default label", async () => {
    incCronRun("aggregate", "success");
    const { body } = await renderMetrics();
    expect(sampleValue(body, "cron_runs_total", { app: "statusbrasil" })).toBe(1);
  });
});

describe("incCronRun", () => {
  it("emits a labelled cron_runs_total counter", async () => {
    incCronRun("aggregate", "success");
    incCronRun("aggregate", "success");
    incCronRun("aggregate", "fail");
    const { body } = await renderMetrics();
    expect(sampleValue(body, "cron_runs_total", { job: "aggregate", outcome: "success" })).toBe(2);
    expect(sampleValue(body, "cron_runs_total", { job: "aggregate", outcome: "fail" })).toBe(1);
  });
});

describe("incGatusRequest", () => {
  it("emits a labelled gatus_requests_total counter", async () => {
    incGatusRequest("/api/v1/endpoints/statuses", "success");
    incGatusRequest("/api/v1/endpoints/statuses", "error");
    const { body } = await renderMetrics();
    expect(
      sampleValue(body, "gatus_requests_total", {
        path: "/api/v1/endpoints/statuses",
        outcome: "success",
      }),
    ).toBe(1);
    expect(
      sampleValue(body, "gatus_requests_total", {
        path: "/api/v1/endpoints/statuses",
        outcome: "error",
      }),
    ).toBe(1);
  });
});

describe("observeHttpRequest", () => {
  it("emits histogram buckets, sum and count", async () => {
    observeHttpRequest("GET", "/api/health", 200, 0.012);
    observeHttpRequest("GET", "/api/health", 200, 0.6);
    const { body } = await renderMetrics();
    expect(sampleValue(body, "http_request_duration_seconds_count", { route: "/api/health" })).toBe(
      2,
    );
    expect(
      sampleValue(body, "http_request_duration_seconds_sum", { route: "/api/health" }),
    ).toBeGreaterThan(0);
  });
});

describe("withHttpMetrics", () => {
  it("records the wrapped handler's status code", async () => {
    const wrapped = withHttpMetrics(
      async () => new Response("ok", { status: 201 }),
      "/test/created",
    );
    const res = await wrapped(new Request("http://localhost/test/created", { method: "POST" }));
    expect(res.status).toBe(201);
    const { body } = await renderMetrics();
    expect(
      sampleValue(body, "http_request_duration_seconds_count", {
        method: "POST",
        route: "/test/created",
        status: "201",
      }),
    ).toBe(1);
  });

  it("records status=500 when the wrapped handler throws", async () => {
    const wrapped = withHttpMetrics(async () => {
      throw new Error("boom");
    }, "/test/throws");
    await expect(
      wrapped(new Request("http://localhost/test/throws", { method: "GET" })),
    ).rejects.toThrow(/boom/);
    const { body } = await renderMetrics();
    expect(
      sampleValue(body, "http_request_duration_seconds_count", {
        route: "/test/throws",
        status: "500",
      }),
    ).toBe(1);
  });
});

function sampleValue(
  body: string,
  metric: string,
  expected: Record<string, string>,
): number | undefined {
  const lineRegex = new RegExp(`^${escapeRegex(metric)}\\{([^}]*)\\}\\s+(\\S+)$`, "gm");
  for (const match of body.matchAll(lineRegex)) {
    const labelString = match[1] ?? "";
    const labels = parseLabels(labelString);
    if (Object.entries(expected).every(([k, v]) => labels[k] === v)) {
      return Number(match[2]);
    }
  }
  return undefined;
}

function parseLabels(labelString: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of labelString.matchAll(/(\w+)="([^"]*)"/g)) {
    if (match[1]) out[match[1]] = match[2] ?? "";
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
