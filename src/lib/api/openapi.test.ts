import { describe, expect, it } from "vitest";
import { generateOpenApiSpec } from "./openapi";

describe("generateOpenApiSpec", () => {
  const spec = generateOpenApiSpec();

  it("declares OpenAPI 3.1.0", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("provides info with title, version, and description", () => {
    expect(spec.info?.title).toBe("StatusBrasil Public API");
    expect(spec.info?.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(spec.info?.description).toBeTruthy();
  });

  it("provides at least one server entry", () => {
    expect(spec.servers).toBeDefined();
    expect((spec.servers ?? []).length).toBeGreaterThan(0);
  });

  it("does not declare any security scheme (public API)", () => {
    expect(spec.security ?? []).toEqual([]);
    expect(spec.components?.securitySchemes).toBeUndefined();
  });

  it("documents the v1 JSON endpoints and the versioned badge SVG under paths", () => {
    const paths = Object.keys(spec.paths ?? {});
    expect(paths).toContain("/api/v1/services");
    expect(paths).toContain("/api/v1/services/{slug}");
    expect(paths).toContain("/api/v1/services/{slug}/history");
    expect(paths).toContain("/api/v1/incidents");
    expect(paths).toContain("/api/badge/{slug}/v1.svg");
    expect(paths).toHaveLength(5);
  });

  it("uses GET for every endpoint", () => {
    for (const [path, item] of Object.entries(spec.paths ?? {})) {
      const operations = Object.keys(item ?? {});
      expect(operations, `path ${path}`).toContain("get");
    }
  });

  it("registers ApiErrorResponse and the response schemas under components.schemas", () => {
    const schemaNames = Object.keys(spec.components?.schemas ?? {});
    expect(schemaNames).toEqual(
      expect.arrayContaining([
        "ApiErrorResponse",
        "ServiceItem",
        "IncidentItem",
        "HourlyPoint",
        "ServicesResponse",
        "ServiceDetailResponse",
        "HistoryResponse",
        "IncidentsResponse",
      ]),
    );
  });

  it("references ApiErrorResponse via $ref on every JSON error response", () => {
    const expectedRef = "#/components/schemas/ApiErrorResponse";
    let errorResponseCount = 0;
    for (const item of Object.values(spec.paths ?? {})) {
      const get = (item as { get?: { responses?: Record<string, unknown> } }).get;
      const responses = get?.responses ?? {};
      for (const [status, response] of Object.entries(responses)) {
        if (Number(status) < 400) continue;
        const json = (
          response as {
            content?: { "application/json"?: { schema?: { $ref?: string } } };
          }
        ).content?.["application/json"];
        // Skip non-JSON error responses (e.g., SVG badge fallbacks).
        if (!json) continue;
        errorResponseCount++;
        expect(json.schema?.$ref, `path response ${status}`).toBe(expectedRef);
      }
    }
    expect(errorResponseCount).toBeGreaterThanOrEqual(8);
  });

  it("declares 429 rate_limited responses on every endpoint", () => {
    for (const [path, item] of Object.entries(spec.paths ?? {})) {
      const get = (item as { get?: { responses?: Record<string, unknown> } }).get;
      expect(get?.responses?.["429"], `path ${path} 429 response`).toBeDefined();
    }
  });
});
