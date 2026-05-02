// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedHourly, seedService, type TestDb } from "./__fixtures__/test-db";
import { getDailyUptimeBars, getLatencyByWindow, getYearToDateSummary } from "./service-detail";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await seedService(testDb.db, { slug: "rf", name: "Receita Federal" });
  await seedService(testDb.db, { slug: "other", name: "Other" });
});

describe("getDailyUptimeBars", () => {
  it("returns the requested number of days, oldest first, with null for empty days", async () => {
    const now = new Date(Date.UTC(2026, 4, 2, 12, 0, 0));
    const points = await getDailyUptimeBars(testDb.db, "rf", 5, { now });
    expect(points).toHaveLength(5);
    expect(points[0]?.date).toEqual(new Date(Date.UTC(2026, 3, 28, 0, 0, 0)));
    expect(points[4]?.date).toEqual(new Date(Date.UTC(2026, 4, 2, 0, 0, 0)));
    for (const p of points) {
      expect(p.uptimePct).toBeNull();
      expect(p.incidentCount).toBe(0);
    }
  });

  it("rolls hourly checks up to a daily uptime%", async () => {
    const day = new Date(Date.UTC(2026, 4, 2, 0, 0, 0));
    // 24 hourly rows; 2 hours had 30/60 failed → daily uptime = (24*60 - 60)/(24*60) = 95.83%
    for (let i = 0; i < 24; i++) {
      await seedHourly(testDb.db, {
        serviceSlug: "rf",
        hour: new Date(day.getTime() + i * 60 * 60 * 1000),
        totalChecks: 60,
        failedChecks: i < 2 ? 30 : 0,
      });
    }
    const now = new Date(Date.UTC(2026, 4, 2, 23, 59, 0));
    const points = await getDailyUptimeBars(testDb.db, "rf", 1, { now });
    expect(points).toHaveLength(1);
    expect(points[0]?.date).toEqual(day);
    expect(points[0]?.uptimePct).toBeCloseTo(95.83, 2);
  });

  it("scopes by slug — other services don't bleed into the bucket", async () => {
    const day = new Date(Date.UTC(2026, 4, 2, 6, 0, 0));
    await seedHourly(testDb.db, { serviceSlug: "rf", hour: day, totalChecks: 10, failedChecks: 0 });
    await seedHourly(testDb.db, {
      serviceSlug: "other",
      hour: day,
      totalChecks: 10,
      failedChecks: 10,
    });
    const points = await getDailyUptimeBars(testDb.db, "rf", 1, { now: day });
    expect(points[0]?.uptimePct).toBe(100);
  });
});

describe("getYearToDateSummary", () => {
  it("aggregates hourly checks from Jan 1 UTC through `now`", async () => {
    const jan15 = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const apr10 = new Date(Date.UTC(2026, 3, 10, 8, 0, 0));
    await seedHourly(testDb.db, {
      serviceSlug: "rf",
      hour: jan15,
      totalChecks: 100,
      failedChecks: 1,
    });
    await seedHourly(testDb.db, {
      serviceSlug: "rf",
      hour: apr10,
      totalChecks: 100,
      failedChecks: 4,
    });

    const summary = await getYearToDateSummary(testDb.db, "rf", {
      now: new Date(Date.UTC(2026, 4, 2, 12, 0, 0)),
    });
    expect(summary.totalChecks).toBe(200);
    expect(summary.failedChecks).toBe(5);
    // (200 - 5) / 200 = 97.5
    expect(summary.uptimePct).toBeCloseTo(97.5, 5);
  });

  it("excludes data from previous calendar years", async () => {
    const dec2025 = new Date(Date.UTC(2025, 11, 31, 23, 0, 0));
    await seedHourly(testDb.db, {
      serviceSlug: "rf",
      hour: dec2025,
      totalChecks: 50,
      failedChecks: 50,
    });
    const summary = await getYearToDateSummary(testDb.db, "rf", {
      now: new Date(Date.UTC(2026, 0, 15, 0, 0, 0)),
    });
    expect(summary.totalChecks).toBe(0);
    expect(summary.uptimePct).toBeNull();
  });

  it("returns null uptime when there are no checks yet", async () => {
    const summary = await getYearToDateSummary(testDb.db, "rf", {
      now: new Date(Date.UTC(2026, 0, 5, 0, 0, 0)),
    });
    expect(summary).toEqual({ uptimePct: null, totalChecks: 0, failedChecks: 0 });
  });
});

describe("getLatencyByWindow", () => {
  it("buckets each sample into every window whose age covers it", async () => {
    const now = new Date(Date.UTC(2026, 4, 2, 12, 0, 0));
    const minus = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

    await seedHourly(testDb.db, { serviceSlug: "rf", hour: minus(2), avgLatencyMs: 100 });
    await seedHourly(testDb.db, { serviceSlug: "rf", hour: minus(72), avgLatencyMs: 200 }); // ≈ 3d
    await seedHourly(testDb.db, { serviceSlug: "rf", hour: minus(24 * 20), avgLatencyMs: 300 }); // 20d
    await seedHourly(testDb.db, { serviceSlug: "rf", hour: minus(24 * 80), avgLatencyMs: 400 }); // 80d

    const windows = await getLatencyByWindow(testDb.db, "rf", { now });
    expect(windows["1d"].map((s) => s.p50)).toEqual([100]);
    expect(windows["7d"].map((s) => s.p50)).toEqual([200, 100]);
    expect(windows["30d"].map((s) => s.p50)).toEqual([300, 200, 100]);
    expect(windows["90d"].map((s) => s.p50)).toEqual([400, 300, 200, 100]);
  });

  it("sets p95 to null since the schema only stores avg latency", async () => {
    const now = new Date(Date.UTC(2026, 4, 2, 12, 0, 0));
    await seedHourly(testDb.db, { serviceSlug: "rf", hour: now, avgLatencyMs: 250 });
    const windows = await getLatencyByWindow(testDb.db, "rf", { now });
    expect(windows["1d"][0]).toEqual({ timestamp: now, p50: 250, p95: null });
  });

  it("excludes samples older than 90 days", async () => {
    const now = new Date(Date.UTC(2026, 4, 2, 12, 0, 0));
    await seedHourly(testDb.db, {
      serviceSlug: "rf",
      hour: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000),
      avgLatencyMs: 999,
    });
    const windows = await getLatencyByWindow(testDb.db, "rf", { now });
    expect(windows["90d"]).toHaveLength(0);
  });
});
