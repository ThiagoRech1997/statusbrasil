import { describe, expect, it } from "vitest";
import {
  ApiErrorResponse,
  DEFAULT_LIMIT,
  HistoryQueryParams,
  HistoryResponse,
  IncidentItem,
  IncidentsQueryParams,
  IncidentsResponse,
  MAX_LIMIT,
  parseSearchParams,
  ServiceDetailResponse,
  ServiceItem,
  ServicesQueryParams,
  ServicesResponse,
} from "./schemas";

describe("ApiErrorResponse", () => {
  it("accepts a valid {error, code} pair", () => {
    expect(ApiErrorResponse.parse({ error: "service not found", code: "not_found" })).toMatchObject(
      { error: "service not found", code: "not_found" },
    );
  });

  it("accepts optional details payload", () => {
    expect(
      ApiErrorResponse.parse({
        error: "validation failed",
        code: "validation_error",
        details: { field: "limit" },
      }).details,
    ).toEqual({ field: "limit" });
  });

  it("rejects an unknown code", () => {
    expect(() => ApiErrorResponse.parse({ error: "x", code: "wat" })).toThrow();
  });

  it("rejects an empty error message", () => {
    expect(() => ApiErrorResponse.parse({ error: "", code: "internal_error" })).toThrow();
  });
});

describe("ServicesQueryParams", () => {
  it("applies defaults when query is empty", () => {
    const result = ServicesQueryParams.parse({});
    expect(result).toMatchObject({ sort: "name", limit: DEFAULT_LIMIT });
    expect(result.cursor).toBeUndefined();
  });

  it("coerces limit from a string", () => {
    expect(ServicesQueryParams.parse({ limit: "42" }).limit).toBe(42);
  });

  it("rejects limit > MAX_LIMIT", () => {
    expect(() => ServicesQueryParams.parse({ limit: String(MAX_LIMIT + 1) })).toThrow();
  });

  it("rejects non-numeric limit with a clear field path", () => {
    const result = ServicesQueryParams.safeParse({ limit: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["limit"]);
    }
  });

  it("accepts the listed status enum values", () => {
    for (const status of ["operational", "degraded", "down", "unknown"] as const) {
      expect(ServicesQueryParams.parse({ status }).status).toBe(status);
    }
  });
});

describe("ServicesResponse", () => {
  it("validates a populated response with a cursor", () => {
    const item = {
      slug: "gov-br",
      name: "Portal gov.br",
      agency: "Governo Federal",
      category: "atendimento",
      sphere: "federal" as const,
      url: "https://www.gov.br/",
      description: null,
      status: "operational" as const,
      uptime_1h: 99.5,
    };
    expect(ServicesResponse.parse({ data: [item], next_cursor: "abc" })).toEqual({
      data: [item],
      next_cursor: "abc",
    });
  });

  it("omits next_cursor when there is no further page", () => {
    const parsed = ServicesResponse.parse({ data: [] });
    expect(parsed.next_cursor).toBeUndefined();
  });

  it("rejects an item with an invalid sphere", () => {
    expect(() =>
      ServiceItem.parse({
        slug: "x",
        name: "x",
        agency: "x",
        category: "x",
        sphere: "global",
        url: "https://x.test/",
        description: null,
        status: "operational",
        uptime_1h: null,
      }),
    ).toThrow();
  });
});

describe("HistoryQueryParams", () => {
  it("treats from and to as optional (handler applies defaults)", () => {
    expect(HistoryQueryParams.parse({})).toEqual({});
    expect(HistoryQueryParams.parse({ from: "2026-04-30T00:00:00Z" })).toEqual({
      from: "2026-04-30T00:00:00Z",
    });
  });

  it("rejects malformed ISO strings", () => {
    expect(() =>
      HistoryQueryParams.parse({ from: "not-a-date", to: "2026-04-30T00:00:00Z" }),
    ).toThrow();
  });

  it("rejects an inverted range when both are present", () => {
    const result = HistoryQueryParams.safeParse({
      from: "2026-04-30T10:00:00Z",
      to: "2026-04-30T08:00:00Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/to must be greater than or equal to from/);
    }
  });

  it("accepts a valid range", () => {
    const v = HistoryQueryParams.parse({
      from: "2026-04-30T08:00:00Z",
      to: "2026-04-30T10:00:00Z",
    });
    expect(v).toEqual({ from: "2026-04-30T08:00:00Z", to: "2026-04-30T10:00:00Z" });
  });
});

describe("HistoryResponse", () => {
  it("validates the response shape", () => {
    const value = {
      slug: "gov-br",
      range: { from: "2026-04-30T08:00:00Z", to: "2026-04-30T10:00:00Z" },
      points: [
        {
          hour: "2026-04-30T08:00:00Z",
          uptime_pct: 99.5,
          avg_latency_ms: 200,
          total_checks: 60,
          failed_checks: 0,
        },
      ],
    };
    expect(HistoryResponse.parse(value)).toEqual(value);
  });

  it("rejects uptime_pct outside [0,100]", () => {
    expect(() =>
      HistoryResponse.parse({
        slug: "x",
        range: { from: "2026-04-30T08:00:00Z", to: "2026-04-30T10:00:00Z" },
        points: [
          {
            hour: "2026-04-30T08:00:00Z",
            uptime_pct: 101,
            avg_latency_ms: 0,
            total_checks: 0,
            failed_checks: 0,
          },
        ],
      }),
    ).toThrow();
  });
});

describe("IncidentsQueryParams", () => {
  it("defaults status to 'all'", () => {
    expect(IncidentsQueryParams.parse({}).status).toBe("all");
  });

  it("accepts open/closed/all and rejects others", () => {
    for (const v of ["open", "closed", "all"] as const) {
      expect(IncidentsQueryParams.parse({ status: v }).status).toBe(v);
    }
    expect(() => IncidentsQueryParams.parse({ status: "pending" })).toThrow();
  });

  it("filters by service slug, severity and date range", () => {
    expect(
      IncidentsQueryParams.parse({
        service: "gov-br",
        severity: "total",
        from: "2026-04-30T00:00:00Z",
        to: "2026-04-30T23:59:59Z",
        limit: "50",
      }),
    ).toMatchObject({
      service: "gov-br",
      severity: "total",
      from: "2026-04-30T00:00:00Z",
      to: "2026-04-30T23:59:59Z",
      limit: 50,
    });
  });

  it("rejects a malformed slug in the service filter", () => {
    expect(() => IncidentsQueryParams.parse({ service: "Gov BR!" })).toThrow();
  });
});

describe("ServiceDetailResponse + IncidentItem + IncidentsResponse", () => {
  const incident = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    service_slug: "gov-br",
    started_at: "2026-04-30T08:00:00Z",
    ended_at: "2026-04-30T08:30:00Z",
    duration_seconds: 1800,
    status_code: 503,
    error_message: "boom",
    severity: "partial" as const,
  };

  it("validates a full ServiceDetailResponse", () => {
    const parsed = ServiceDetailResponse.parse({
      service: {
        slug: "gov-br",
        name: "Portal gov.br",
        agency: "Governo Federal",
        category: "atendimento",
        sphere: "federal",
        url: "https://www.gov.br/",
        description: null,
        status: "operational",
        uptime_1h: 100,
      },
      uptime_pct_30d: 99.95,
      mttr_30d_seconds: 1200,
      last_incident: incident,
    });
    expect(parsed.uptime_pct_30d).toBe(99.95);
    expect(parsed.mttr_30d_seconds).toBe(1200);
    expect(parsed.last_incident?.id).toBe(incident.id);
  });

  it("accepts null for the 30d metrics and last_incident when there is no data", () => {
    const parsed = ServiceDetailResponse.parse({
      service: {
        slug: "x",
        name: "X",
        agency: "X",
        category: "x",
        sphere: "federal",
        url: "https://x.test/",
        description: null,
        status: "unknown",
        uptime_1h: null,
      },
      uptime_pct_30d: null,
      mttr_30d_seconds: null,
      last_incident: null,
    });
    expect(parsed.uptime_pct_30d).toBeNull();
    expect(parsed.mttr_30d_seconds).toBeNull();
    expect(parsed.last_incident).toBeNull();
  });

  it("rejects an incident with a non-uuid id", () => {
    expect(() => IncidentItem.parse({ ...incident, id: "not-a-uuid" })).toThrow();
  });

  it("validates IncidentsResponse and omits next_cursor on the last page", () => {
    const parsed = IncidentsResponse.parse({ data: [incident] });
    expect(parsed.data).toHaveLength(1);
    expect(parsed.next_cursor).toBeUndefined();
  });
});

describe("parseSearchParams", () => {
  it("turns URLSearchParams into a parsed query object", () => {
    const sp = new URLSearchParams("category=saude&status=down&limit=20");
    expect(parseSearchParams(ServicesQueryParams, sp)).toMatchObject({
      category: "saude",
      status: "down",
      limit: 20,
      sort: "name",
    });
  });

  it("propagates schema errors with field paths", () => {
    const sp = new URLSearchParams("limit=abc");
    expect(() => parseSearchParams(ServicesQueryParams, sp)).toThrow();
  });
});
