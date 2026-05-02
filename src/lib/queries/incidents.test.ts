// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "./__fixtures__/test-db";
import { createTestDb, seedIncident, seedService } from "./__fixtures__/test-db";
import { getIncident, getRecentByService, listIncidents } from "./incidents";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await seedService(testDb.db, { slug: "svc-a" });
  await seedService(testDb.db, { slug: "svc-b" });
});

describe("listIncidents", () => {
  it("returns all incidents in reverse chronological order", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      endedAt: new Date("2026-04-30T08:30:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-b",
      startedAt: new Date("2026-04-30T10:00:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T09:00:00Z"),
      endedAt: new Date("2026-04-30T09:15:00Z"),
    });

    const rows = await listIncidents(testDb.db);
    expect(rows.map((r) => r.startedAt.toISOString())).toEqual([
      "2026-04-30T10:00:00.000Z",
      "2026-04-30T09:00:00.000Z",
      "2026-04-30T08:00:00.000Z",
    ]);
  });

  it("filters by serviceSlug", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T08:00:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-b",
      startedAt: new Date("2026-04-30T08:00:00Z"),
    });
    const rows = await listIncidents(testDb.db, { serviceSlug: "svc-a" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.serviceSlug).toBe("svc-a");
  });

  it("filters by status open vs closed", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      endedAt: new Date("2026-04-30T08:30:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T09:00:00Z"),
    });

    const open = await listIncidents(testDb.db, { status: "open" });
    const closed = await listIncidents(testDb.db, { status: "closed" });
    expect(open).toHaveLength(1);
    expect(open[0]?.endedAt).toBeNull();
    expect(closed).toHaveLength(1);
    expect(closed[0]?.endedAt).not.toBeNull();
  });

  it("filters by severity", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      severity: "partial",
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T09:00:00Z"),
      severity: "total",
    });

    const total = await listIncidents(testDb.db, { severity: "total" });
    expect(total).toHaveLength(1);
    expect(total[0]?.severity).toBe("total");
  });

  it("filters by from/to range on startedAt", async () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 30, h, 0, 0));
    for (const hour of [6, 8, 10, 12]) {
      await seedIncident(testDb.db, { serviceSlug: "svc-a", startedAt: at(hour) });
    }
    const rows = await listIncidents(testDb.db, { from: at(8), to: at(10) });
    expect(rows.map((r) => r.startedAt.toISOString())).toEqual([
      at(10).toISOString(),
      at(8).toISOString(),
    ]);
  });

  it("paginates with limit and offset", async () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 30, h, 0, 0));
    for (const hour of [6, 7, 8, 9, 10]) {
      await seedIncident(testDb.db, { serviceSlug: "svc-a", startedAt: at(hour) });
    }
    const page1 = await listIncidents(testDb.db, { limit: 2 });
    const page2 = await listIncidents(testDb.db, { limit: 2, offset: 2 });
    expect(page1.map((r) => r.startedAt.toISOString())).toEqual([
      at(10).toISOString(),
      at(9).toISOString(),
    ]);
    expect(page2.map((r) => r.startedAt.toISOString())).toEqual([
      at(8).toISOString(),
      at(7).toISOString(),
    ]);
  });

  it("clamps an over-cap limit to the maximum", async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedIncident(testDb.db, {
        serviceSlug: "svc-a",
        startedAt: new Date(Date.UTC(2026, 3, 30, i, 0, 0)),
      });
    }
    const rows = await listIncidents(testDb.db, { limit: 100000 });
    expect(rows.length).toBeLessThanOrEqual(200);
    expect(rows).toHaveLength(5);
  });
});

describe("getIncident", () => {
  it("returns the incident when it exists", async () => {
    const id = await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      statusCode: 503,
      errorMessage: "boom",
    });
    const row = await getIncident(testDb.db, id);
    expect(row).toMatchObject({
      id,
      serviceSlug: "svc-a",
      statusCode: 503,
      errorMessage: "boom",
    });
  });

  it("returns null when the incident does not exist", async () => {
    const row = await getIncident(testDb.db, "00000000-0000-0000-0000-000000000000");
    expect(row).toBeNull();
  });
});

describe("getRecentByService", () => {
  it("returns up to limit incidents for the service, most recent first", async () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 30, h, 0, 0));
    for (const hour of [4, 5, 6, 7, 8]) {
      await seedIncident(testDb.db, { serviceSlug: "svc-a", startedAt: at(hour) });
    }
    await seedIncident(testDb.db, { serviceSlug: "svc-b", startedAt: at(9) });

    const rows = await getRecentByService(testDb.db, "svc-a", 3);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.startedAt.toISOString())).toEqual([
      at(8).toISOString(),
      at(7).toISOString(),
      at(6).toISOString(),
    ]);
    expect(rows.every((r) => r.serviceSlug === "svc-a")).toBe(true);
  });

  it("defaults to a limit of 10", async () => {
    for (let i = 0; i < 15; i += 1) {
      await seedIncident(testDb.db, {
        serviceSlug: "svc-a",
        startedAt: new Date(Date.UTC(2026, 3, 30, i % 24, 0, 0)),
      });
    }
    const rows = await getRecentByService(testDb.db, "svc-a");
    expect(rows).toHaveLength(10);
  });
});
