// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "./__fixtures__/test-db";
import { createTestDb, seedHourly, seedIncident, seedService } from "./__fixtures__/test-db";
import {
  getCumulativeDowntime24h,
  getHistoryHourly,
  getMonthSummary,
  monthBoundsUTC,
} from "./uptime";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await seedService(testDb.db, { slug: "svc-a", name: "Svc A" });
  await seedService(testDb.db, { slug: "svc-b", name: "Svc B" });
});

describe("getHistoryHourly", () => {
  it("returns hourly points for a service in chronological order, scoped to the range", async () => {
    const h = (offsetH: number) => new Date(Date.UTC(2026, 3, 30, offsetH, 0, 0));
    await seedHourly(testDb.db, { serviceSlug: "svc-a", hour: h(8), uptimePct: 99.5 });
    await seedHourly(testDb.db, { serviceSlug: "svc-a", hour: h(9), uptimePct: 100 });
    await seedHourly(testDb.db, { serviceSlug: "svc-a", hour: h(10), uptimePct: 50 });
    await seedHourly(testDb.db, { serviceSlug: "svc-a", hour: h(11), uptimePct: 100 });
    await seedHourly(testDb.db, { serviceSlug: "svc-b", hour: h(9), uptimePct: 100 });

    const points = await getHistoryHourly(testDb.db, "svc-a", { from: h(9), to: h(10) });
    expect(points.map((p) => [p.hour.toISOString(), p.uptimePct])).toEqual([
      [h(9).toISOString(), 100],
      [h(10).toISOString(), 50],
    ]);
    expect(typeof points[0]?.uptimePct).toBe("number");
  });

  it("returns an empty array when there is no data in range", async () => {
    const points = await getHistoryHourly(testDb.db, "svc-a", {
      from: new Date("2030-01-01T00:00:00Z"),
      to: new Date("2030-01-02T00:00:00Z"),
    });
    expect(points).toEqual([]);
  });

  it("rejects an inverted range", async () => {
    await expect(
      getHistoryHourly(testDb.db, "svc-a", {
        from: new Date("2026-04-30T10:00:00Z"),
        to: new Date("2026-04-30T08:00:00Z"),
      }),
    ).rejects.toThrow(/range\.to must be >= range\.from/);
  });
});

describe("monthBoundsUTC", () => {
  it("returns first and next-first day of month in UTC regardless of input day", async () => {
    const { start, end } = monthBoundsUTC(new Date("2026-04-15T13:45:30Z"));
    expect(start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("crosses year boundary correctly", async () => {
    const { start, end } = monthBoundsUTC(new Date("2026-12-25T00:00:00Z"));
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("getMonthSummary", () => {
  const APRIL = new Date("2026-04-15T00:00:00Z");

  it("aggregates hourly checks and incidents within the month", async () => {
    const h = (day: number, hour: number) => new Date(Date.UTC(2026, 3, day, hour, 0, 0));
    await seedHourly(testDb.db, {
      serviceSlug: "svc-a",
      hour: h(1, 0),
      totalChecks: 60,
      failedChecks: 6,
    });
    await seedHourly(testDb.db, {
      serviceSlug: "svc-a",
      hour: h(15, 12),
      totalChecks: 60,
      failedChecks: 4,
    });
    await seedHourly(testDb.db, {
      serviceSlug: "svc-a",
      hour: new Date(Date.UTC(2026, 4, 1, 0, 0, 0)),
      totalChecks: 60,
      failedChecks: 60,
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: h(2, 10),
      endedAt: h(2, 11),
    });
    const startSecond = new Date(Date.UTC(2026, 3, 20, 9, 0, 0));
    const endSecond = new Date(startSecond.getTime() + 30 * 60 * 1000);
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: startSecond,
      endedAt: endSecond,
    });

    const summary = await getMonthSummary(testDb.db, "svc-a", APRIL);
    expect(summary.month.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(summary.totalChecks).toBe(120);
    expect(summary.failedChecks).toBe(10);
    expect(summary.uptimePct).toBeCloseTo(((120 - 10) / 120) * 100, 5);
    expect(summary.totalIncidents).toBe(2);
    expect(summary.totalDowntimeSeconds).toBe(1800 + 3600);
  });

  it("returns null uptime and zeroed counters when there is no data", async () => {
    const summary = await getMonthSummary(testDb.db, "svc-a", APRIL);
    expect(summary).toEqual({
      month: new Date("2026-04-01T00:00:00.000Z"),
      uptimePct: null,
      totalChecks: 0,
      failedChecks: 0,
      totalIncidents: 0,
      totalDowntimeSeconds: 0,
    });
  });

  it("does not bleed across services", async () => {
    const h = new Date(Date.UTC(2026, 3, 10, 8, 0, 0));
    await seedHourly(testDb.db, {
      serviceSlug: "svc-a",
      hour: h,
      totalChecks: 60,
      failedChecks: 0,
    });
    await seedHourly(testDb.db, {
      serviceSlug: "svc-b",
      hour: h,
      totalChecks: 60,
      failedChecks: 30,
    });

    const a = await getMonthSummary(testDb.db, "svc-a", APRIL);
    const b = await getMonthSummary(testDb.db, "svc-b", APRIL);
    expect(a.failedChecks).toBe(0);
    expect(b.failedChecks).toBe(30);
  });
});

describe("getCumulativeDowntime24h", () => {
  const NOW = new Date("2026-04-30T12:00:00Z");

  it("sums the in-window overlap of each incident, clipping at the window edges", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T11:00:00Z"),
      endedAt: new Date("2026-04-30T11:30:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      endedAt: new Date("2026-04-30T09:00:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-b",
      startedAt: new Date("2026-04-29T11:30:00Z"),
      endedAt: new Date("2026-04-30T12:30:00Z"),
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc-b",
      startedAt: new Date("2026-04-30T11:00:00Z"),
      endedAt: null,
    });

    const downtime = await getCumulativeDowntime24h(testDb.db, { now: NOW });
    expect(downtime["svc-a"]).toBe(30 * 60 + 60 * 60);
    expect(downtime["svc-b"]).toBe(HOURS(24) + HOURS(1));
  });

  it("excludes incidents that end before the 24h window", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-29T08:00:00Z"),
      endedAt: new Date("2026-04-29T09:00:00Z"),
    });
    const downtime = await getCumulativeDowntime24h(testDb.db, { now: NOW });
    expect(downtime).toEqual({});
  });

  it("scopes to slugs and zero-fills missing services", async () => {
    await seedIncident(testDb.db, {
      serviceSlug: "svc-a",
      startedAt: new Date("2026-04-30T11:00:00Z"),
      endedAt: new Date("2026-04-30T11:30:00Z"),
    });
    const downtime = await getCumulativeDowntime24h(testDb.db, {
      slugs: ["svc-a", "svc-b"],
      now: NOW,
    });
    expect(downtime).toEqual({ "svc-a": 30 * 60, "svc-b": 0 });
  });
});

function HOURS(n: number): number {
  return n * 60 * 60;
}
