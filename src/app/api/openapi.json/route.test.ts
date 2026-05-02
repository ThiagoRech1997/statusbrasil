import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/metrics", () => ({
  withHttpMetrics: <T extends (...args: unknown[]) => unknown>(handler: T): T => handler,
}));

import { GET } from "./route";

describe("GET /api/openapi.json", () => {
  it("returns 200 with the public cache-control header from the task spec", async () => {
    const res = await GET(new Request("http://localhost/api/openapi.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("s-maxage=3600, stale-while-revalidate=7200");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("returns a parseable OpenAPI 3.1 document", async () => {
    const res = await GET(new Request("http://localhost/api/openapi.json"));
    const body = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths)).toHaveLength(5);
  });
});
