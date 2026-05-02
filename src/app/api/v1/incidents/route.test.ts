import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncidentRow } from "@/lib/queries/incidents";

const listIncidentsMock = vi.fn();

vi.mock("@/lib/queries/incidents", () => ({
  listIncidents: listIncidentsMock,
}));

vi.mock("@/lib/db", () => ({ db: {} as Record<string, never> }));

vi.mock("@/lib/metrics", () => ({
  withHttpMetrics: <T extends (...args: unknown[]) => unknown>(handler: T): T => handler,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function loadRoute() {
  vi.resetModules();
  return await import("./route");
}

function makeRequest(query = ""): Request {
  return new Request(`http://localhost/api/v1/incidents${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

function row(over: Partial<IncidentRow> & { id: string; startedAt: Date }): IncidentRow {
  return {
    id: over.id,
    serviceSlug: over.serviceSlug ?? "gov-br",
    startedAt: over.startedAt,
    endedAt: "endedAt" in over ? (over.endedAt as Date | null) : null,
    durationSeconds: "durationSeconds" in over ? (over.durationSeconds as number | null) : null,
    statusCode: "statusCode" in over ? (over.statusCode as number | null) : null,
    errorMessage: "errorMessage" in over ? (over.errorMessage as string | null) : null,
    severity: over.severity ?? "partial",
  };
}

describe("GET /api/v1/incidents", () => {
  beforeEach(() => {
    listIncidentsMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 200 with default Cache-Control and started_at DESC ordering", async () => {
    listIncidentsMock.mockResolvedValue([
      row({
        id: "550e8400-e29b-41d4-a716-446655440001",
        startedAt: new Date("2026-04-30T10:00:00Z"),
      }),
      row({
        id: "550e8400-e29b-41d4-a716-446655440002",
        startedAt: new Date("2026-04-30T08:00:00Z"),
      }),
    ]);
    const { GET } = await loadRoute();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("s-maxage=60, stale-while-revalidate=300");
    const body = await res.json();
    expect(body.data.map((i: { started_at: string }) => i.started_at)).toEqual([
      "2026-04-30T10:00:00.000Z",
      "2026-04-30T08:00:00.000Z",
    ]);
    expect(body.next_cursor).toBeUndefined();
  });

  it("emits items in snake_case wire format", async () => {
    listIncidentsMock.mockResolvedValue([
      row({
        id: "550e8400-e29b-41d4-a716-446655440003",
        serviceSlug: "gov-br",
        startedAt: new Date("2026-04-30T08:00:00Z"),
        endedAt: new Date("2026-04-30T08:30:00Z"),
        durationSeconds: 1800,
        statusCode: 503,
        errorMessage: "boom",
        severity: "partial",
      }),
    ]);
    const { GET } = await loadRoute();

    const body = await (await GET(makeRequest())).json();
    expect(body.data[0]).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440003",
      service_slug: "gov-br",
      started_at: "2026-04-30T08:00:00.000Z",
      ended_at: "2026-04-30T08:30:00.000Z",
      duration_seconds: 1800,
      status_code: 503,
      error_message: "boom",
      severity: "partial",
    });
  });

  it("forwards filters to listIncidents (service → serviceSlug, from/to → Date, severity)", async () => {
    listIncidentsMock.mockResolvedValue([]);
    const { GET } = await loadRoute();

    await GET(
      makeRequest(
        "service=gov-br&severity=total&from=2026-04-01T00:00:00Z&to=2026-04-30T23:59:59Z&limit=20",
      ),
    );

    expect(listIncidentsMock).toHaveBeenCalledTimes(1);
    const call = listIncidentsMock.mock.calls[0]?.[1];
    expect(call).toMatchObject({
      serviceSlug: "gov-br",
      severity: "total",
      offset: 0,
      limit: 21,
    });
    expect(call.from).toBeInstanceOf(Date);
    expect(call.from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(call.to).toBeInstanceOf(Date);
    expect(call.to.toISOString()).toBe("2026-04-30T23:59:59.000Z");
  });

  it("paginates with limit and emits next_cursor when more remain", async () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 30, h, 0, 0));
    const id1 = "550e8400-e29b-41d4-a716-446655440001";
    const id2 = "550e8400-e29b-41d4-a716-446655440002";
    const id3 = "550e8400-e29b-41d4-a716-446655440003";
    // Page 1: limit=2 → fetch 3 → return first 2 + next_cursor
    listIncidentsMock.mockResolvedValueOnce([
      row({ id: id1, startedAt: at(13) }),
      row({ id: id2, startedAt: at(12) }),
      row({ id: id3, startedAt: at(11) }),
    ]);
    const { GET } = await loadRoute();

    const page1 = await (await GET(makeRequest("limit=2"))).json();
    expect(page1.data).toHaveLength(2);
    expect(page1.next_cursor).toBeDefined();
    expect(listIncidentsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ offset: 0, limit: 3 }),
    );

    // Page 2: limit=2, cursor decodes to offset=2 → fetch from offset=2
    listIncidentsMock.mockResolvedValueOnce([row({ id: id3, startedAt: at(11) })]);
    const page2 = await (
      await GET(makeRequest(`limit=2&cursor=${encodeURIComponent(page1.next_cursor)}`))
    ).json();
    expect(page2.data.map((i: { id: string }) => i.id)).toEqual([id3]);
    expect(page2.next_cursor).toBeUndefined();
    expect(listIncidentsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ offset: 2, limit: 3 }),
    );
  });

  it("returns 400 with field-pathed details on a non-numeric limit, no DB hit, no Cache-Control", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("limit=abc"));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBeNull();
    const body = await res.json();
    expect(body.code).toBe("validation_error");
    expect(body.details).toEqual(expect.objectContaining({ limit: expect.any(Array) }));
    expect(listIncidentsMock).not.toHaveBeenCalled();
  });

  it("returns 400 on limit > 100", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("limit=101"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on a malformed cursor with details.cursor", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("cursor=not-a-real-cursor"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
    expect(body.details).toEqual(expect.objectContaining({ cursor: expect.any(Array) }));
    expect(listIncidentsMock).not.toHaveBeenCalled();
  });

  it("returns 400 on an unsupported severity", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("severity=catastrophic"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on a malformed service slug", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("service=Bad%20Slug%21"));
    expect(res.status).toBe(400);
  });

  it("accepts the optional ?status filter (open/closed/all)", async () => {
    listIncidentsMock.mockResolvedValue([]);
    const { GET } = await loadRoute();
    await GET(makeRequest("status=open"));
    expect(listIncidentsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "open" }),
    );
  });
});
