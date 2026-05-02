// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "./__fixtures__/test-db";
import { createTestDb, seedHourly, seedIncident, seedService } from "./__fixtures__/test-db";
import {
  getHomeDashboard,
  getServiceBySlug,
  getServicesByCategoryStatus,
  getServiceWithStatusBySlug,
  listServices,
} from "./services";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
});

describe("listServices", () => {
  it("returns all services ordered by name", async () => {
    await seedService(testDb.db, { slug: "b", name: "Beta" });
    await seedService(testDb.db, { slug: "a", name: "Alpha" });
    await seedService(testDb.db, { slug: "c", name: "Gamma" });

    const rows = await listServices(testDb.db);
    expect(rows.map((r) => r.slug)).toEqual(["a", "b", "c"]);
  });

  it("filters out inactive when activeOnly is set", async () => {
    await seedService(testDb.db, { slug: "live", name: "Live", active: true });
    await seedService(testDb.db, { slug: "dead", name: "Dead", active: false });

    const all = await listServices(testDb.db);
    const active = await listServices(testDb.db, { activeOnly: true });

    expect(all).toHaveLength(2);
    expect(active.map((r) => r.slug)).toEqual(["live"]);
  });
});

describe("getServiceBySlug", () => {
  it("returns the service when it exists", async () => {
    await seedService(testDb.db, {
      slug: "gov-br",
      name: "Portal gov.br",
      category: "atendimento",
      sphere: "federal",
    });
    const row = await getServiceBySlug(testDb.db, "gov-br");
    expect(row).toMatchObject({
      slug: "gov-br",
      name: "Portal gov.br",
      category: "atendimento",
      sphere: "federal",
    });
  });

  it("returns null when the service does not exist", async () => {
    const row = await getServiceBySlug(testDb.db, "missing");
    expect(row).toBeNull();
  });
});

describe("getServicesByCategoryStatus", () => {
  const NOW = new Date("2026-04-30T12:00:00Z");

  it("groups by category and derives status from latest hourly + open incidents", async () => {
    await seedService(testDb.db, { slug: "good", name: "Good", category: "saude" });
    await seedService(testDb.db, { slug: "slow", name: "Slow", category: "saude" });
    await seedService(testDb.db, { slug: "broken", name: "Broken", category: "saude" });
    await seedService(testDb.db, { slug: "stale", name: "Stale", category: "trabalho" });
    await seedService(testDb.db, { slug: "totaled", name: "Totaled", category: "trabalho" });

    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000);
    const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);

    await seedHourly(testDb.db, { serviceSlug: "good", hour: oneHourAgo, uptimePct: 100 });
    await seedHourly(testDb.db, { serviceSlug: "slow", hour: oneHourAgo, uptimePct: 95 });
    await seedHourly(testDb.db, { serviceSlug: "broken", hour: oneHourAgo, uptimePct: 30 });
    await seedHourly(testDb.db, { serviceSlug: "stale", hour: threeHoursAgo, uptimePct: 100 });
    await seedHourly(testDb.db, { serviceSlug: "totaled", hour: oneHourAgo, uptimePct: 100 });

    await seedIncident(testDb.db, {
      serviceSlug: "totaled",
      startedAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      severity: "total",
    });

    const groups = await getServicesByCategoryStatus(testDb.db, { now: NOW });

    expect(groups.map((g) => g.category)).toEqual(["saude", "trabalho"]);

    const saude = groups.find((g) => g.category === "saude");
    const byStatus = Object.fromEntries((saude?.services ?? []).map((s) => [s.slug, s.status]));
    expect(byStatus).toEqual({ broken: "down", good: "operational", slow: "degraded" });

    const trabalho = groups.find((g) => g.category === "trabalho");
    const trabalhoStatus = Object.fromEntries(
      (trabalho?.services ?? []).map((s) => [s.slug, s.status]),
    );
    expect(trabalhoStatus).toEqual({ stale: "unknown", totaled: "down" });
  });

  it("returns uptime1h as a number, not a string", async () => {
    await seedService(testDb.db, { slug: "n1", name: "N", category: "saude" });
    await seedHourly(testDb.db, {
      serviceSlug: "n1",
      hour: new Date(NOW.getTime() - 30 * 60 * 1000),
      uptimePct: 99.5,
    });

    const groups = await getServicesByCategoryStatus(testDb.db, { now: NOW });
    const svc = groups[0]?.services[0];
    expect(svc?.uptime1h).toBe(99.5);
    expect(typeof svc?.uptime1h).toBe("number");
  });

  it("excludes inactive services", async () => {
    await seedService(testDb.db, { slug: "active", name: "A", category: "x", active: true });
    await seedService(testDb.db, { slug: "inactive", name: "I", category: "x", active: false });

    const groups = await getServicesByCategoryStatus(testDb.db, { now: NOW });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.services.map((s) => s.slug)).toEqual(["active"]);
  });

  it("treats partial open incident as degraded even when uptime is high", async () => {
    await seedService(testDb.db, { slug: "blip", name: "Blip", category: "saude" });
    await seedHourly(testDb.db, {
      serviceSlug: "blip",
      hour: new Date(NOW.getTime() - 30 * 60 * 1000),
      uptimePct: 100,
    });
    await seedIncident(testDb.db, {
      serviceSlug: "blip",
      startedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
      severity: "partial",
    });

    const [group] = await getServicesByCategoryStatus(testDb.db, { now: NOW });
    expect(group?.services[0]?.status).toBe("degraded");
  });
});

describe("getServiceWithStatusBySlug", () => {
  const NOW = new Date("2026-04-30T12:00:00Z");

  it("returns null when the slug is unknown", async () => {
    const result = await getServiceWithStatusBySlug(testDb.db, "missing", { now: NOW });
    expect(result).toBeNull();
  });

  it("returns the service with derived status from the latest hourly row", async () => {
    await seedService(testDb.db, { slug: "good", name: "Good" });
    await seedHourly(testDb.db, {
      serviceSlug: "good",
      hour: new Date(NOW.getTime() - 30 * 60 * 1000),
      uptimePct: 99.5,
    });
    const result = await getServiceWithStatusBySlug(testDb.db, "good", { now: NOW });
    expect(result).toMatchObject({ slug: "good", status: "operational", uptime1h: 99.5 });
  });

  it("returns status 'unknown' when no hourly row exists in the freshness window", async () => {
    await seedService(testDb.db, { slug: "stale", name: "Stale" });
    await seedHourly(testDb.db, {
      serviceSlug: "stale",
      hour: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      uptimePct: 100,
    });
    const result = await getServiceWithStatusBySlug(testDb.db, "stale", { now: NOW });
    expect(result?.status).toBe("unknown");
    expect(result?.uptime1h).toBeNull();
  });

  it("escalates to 'down' on a total open incident regardless of uptime", async () => {
    await seedService(testDb.db, { slug: "totaled", name: "Totaled" });
    await seedHourly(testDb.db, {
      serviceSlug: "totaled",
      hour: new Date(NOW.getTime() - 10 * 60 * 1000),
      uptimePct: 100,
    });
    await seedIncident(testDb.db, {
      serviceSlug: "totaled",
      startedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
      severity: "total",
    });
    const result = await getServiceWithStatusBySlug(testDb.db, "totaled", { now: NOW });
    expect(result?.status).toBe("down");
  });
});

describe("getHomeDashboard", () => {
  const NOW = new Date("2026-04-30T12:00:00Z");
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  it("returns an empty list when no services exist", async () => {
    const groups = await getHomeDashboard(testDb.db, { now: NOW });
    expect(groups).toEqual([]);
  });

  it("aggregates uptime over the last 7 days, ignoring older buckets", async () => {
    await seedService(testDb.db, { slug: "svc", category: "saude" });
    // Inside 7d window: 600 checks, 6 failed → uptime = 99%
    await seedHourly(testDb.db, {
      serviceSlug: "svc",
      hour: new Date(NOW.getTime() - HOUR_MS),
      totalChecks: 100,
      failedChecks: 1,
    });
    await seedHourly(testDb.db, {
      serviceSlug: "svc",
      hour: new Date(NOW.getTime() - 2 * DAY_MS),
      totalChecks: 500,
      failedChecks: 5,
    });
    // Outside 7d window: must be ignored
    await seedHourly(testDb.db, {
      serviceSlug: "svc",
      hour: new Date(NOW.getTime() - 8 * DAY_MS),
      totalChecks: 1000,
      failedChecks: 1000,
    });

    const [group] = await getHomeDashboard(testDb.db, { now: NOW });
    const svc = group?.services[0];
    expect(svc?.uptime7dPct).toBeCloseTo(99, 5);
  });

  it("returns null uptime7dPct when there are no hourly rows in the 7d window", async () => {
    await seedService(testDb.db, { slug: "fresh", category: "saude" });
    await seedHourly(testDb.db, {
      serviceSlug: "fresh",
      hour: new Date(NOW.getTime() - 8 * DAY_MS),
      totalChecks: 100,
      failedChecks: 0,
    });

    const [group] = await getHomeDashboard(testDb.db, { now: NOW });
    expect(group?.services[0]?.uptime7dPct).toBeNull();
  });

  it("aggregates uptime over the last 24 hours, ignoring older buckets", async () => {
    await seedService(testDb.db, { slug: "svc", category: "saude" });
    // Inside 24h window: 50 checks, 1 failed → uptime = 98%
    await seedHourly(testDb.db, {
      serviceSlug: "svc",
      hour: new Date(NOW.getTime() - 2 * HOUR_MS),
      totalChecks: 50,
      failedChecks: 1,
    });
    // Outside 24h but still inside 7d. The high failure ratio is intentional —
    // it lets us assert that the 24h window pegs at 98% while the 7d window
    // sees a much worse 54%, proving the windows are independent.
    await seedHourly(testDb.db, {
      serviceSlug: "svc",
      hour: new Date(NOW.getTime() - 2 * DAY_MS),
      totalChecks: 500,
      failedChecks: 250,
    });

    const [group] = await getHomeDashboard(testDb.db, { now: NOW });
    expect(group?.services[0]?.uptime24hPct).toBeCloseTo(98, 5);
    // 7d sums both rows: (550 - 251) / 550 = 54.36...%
    expect(group?.services[0]?.uptime7dPct).toBeCloseTo(54.3636, 3);
  });

  it("returns null uptime24hPct when no hourly rows fall inside the 24h window", async () => {
    await seedService(testDb.db, { slug: "stale", category: "saude" });
    await seedHourly(testDb.db, {
      serviceSlug: "stale",
      hour: new Date(NOW.getTime() - 2 * DAY_MS),
      totalChecks: 100,
      failedChecks: 0,
    });

    const [group] = await getHomeDashboard(testDb.db, { now: NOW });
    expect(group?.services[0]?.uptime24hPct).toBeNull();
    // 7d still has data
    expect(group?.services[0]?.uptime7dPct).toBeCloseTo(100, 5);
  });

  it("picks the most recent incident's startedAt regardless of severity or open/closed", async () => {
    await seedService(testDb.db, { slug: "svc", category: "saude" });
    const older = new Date(NOW.getTime() - 5 * DAY_MS);
    const newer = new Date(NOW.getTime() - 2 * HOUR_MS);
    await seedIncident(testDb.db, {
      serviceSlug: "svc",
      startedAt: older,
      endedAt: new Date(older.getTime() + HOUR_MS),
      severity: "total",
    });
    await seedIncident(testDb.db, {
      serviceSlug: "svc",
      startedAt: newer,
      severity: "partial",
    });

    const [group] = await getHomeDashboard(testDb.db, { now: NOW });
    expect(group?.services[0]?.lastIncidentAt?.toISOString()).toBe(newer.toISOString());
  });

  it("returns null lastIncidentAt for services without any incident", async () => {
    await seedService(testDb.db, { slug: "clean", category: "saude" });
    await seedHourly(testDb.db, {
      serviceSlug: "clean",
      hour: new Date(NOW.getTime() - HOUR_MS),
      totalChecks: 60,
      failedChecks: 0,
    });

    const [group] = await getHomeDashboard(testDb.db, { now: NOW });
    expect(group?.services[0]?.lastIncidentAt).toBeNull();
  });

  it("preserves the category grouping shape from getServicesByCategoryStatus", async () => {
    await seedService(testDb.db, { slug: "a", category: "saude" });
    await seedService(testDb.db, { slug: "b", category: "trabalho" });
    await seedHourly(testDb.db, {
      serviceSlug: "a",
      hour: new Date(NOW.getTime() - HOUR_MS),
      totalChecks: 60,
      failedChecks: 0,
    });
    await seedHourly(testDb.db, {
      serviceSlug: "b",
      hour: new Date(NOW.getTime() - HOUR_MS),
      totalChecks: 60,
      failedChecks: 0,
    });

    const groups = await getHomeDashboard(testDb.db, { now: NOW });
    expect(groups.map((g) => g.category)).toEqual(["saude", "trabalho"]);
    expect(groups.flatMap((g) => g.services.map((s) => s.slug))).toEqual(["a", "b"]);
  });
});
