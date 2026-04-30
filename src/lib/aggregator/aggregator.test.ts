import { describe, expect, it } from "vitest";
import type { EndpointResult } from "@/lib/gatus/schemas";
import { bucketByHour, computeTransitions, resolveHours } from "./index";

const NS_PER_MS = 1_000_000;

function ok(timestamp: string, durationMs = 200): EndpointResult {
  return {
    status: 200,
    duration: durationMs * NS_PER_MS,
    errors: [],
    conditionResults: [],
    success: true,
    timestamp,
  };
}

function fail(timestamp: string, status = 503, error = "boom"): EndpointResult {
  return {
    status,
    duration: 1500 * NS_PER_MS,
    errors: [error],
    conditionResults: [],
    success: false,
    timestamp,
  };
}

describe("resolveHours", () => {
  it("returns the default when input is null or empty", () => {
    expect(resolveHours(null)).toBe(2);
    expect(resolveHours(undefined)).toBe(2);
    expect(resolveHours("")).toBe(2);
  });

  it("parses positive integers", () => {
    expect(resolveHours("1")).toBe(1);
    expect(resolveHours("24")).toBe(24);
  });

  it("rejects non-numeric, zero, and negative input", () => {
    expect(() => resolveHours("abc")).toThrow(/invalid hours/);
    expect(() => resolveHours("0")).toThrow(/invalid hours/);
    expect(() => resolveHours("-1")).toThrow(/invalid hours/);
  });

  it("rejects values greater than the cap (7 days)", () => {
    expect(() => resolveHours("169")).toThrow(/exceeds max/);
  });
});

describe("bucketByHour", () => {
  it("groups by UTC hour and sums totals/failures", () => {
    const buckets = bucketByHour([
      ok("2026-04-30T10:01:00Z", 100),
      ok("2026-04-30T10:31:00Z", 200),
      fail("2026-04-30T10:46:00Z"),
      ok("2026-04-30T11:01:00Z", 300),
    ]);

    const hour10 = Date.UTC(2026, 3, 30, 10);
    const hour11 = Date.UTC(2026, 3, 30, 11);

    expect(buckets.get(hour10)).toEqual({ total: 3, failed: 1, totalLatencyMs: 1800 });
    expect(buckets.get(hour11)).toEqual({ total: 1, failed: 0, totalLatencyMs: 300 });
  });

  it("normalizes minute-of-hour onto the same bucket key", () => {
    const buckets = bucketByHour([ok("2026-04-30T09:00:00Z"), ok("2026-04-30T09:59:59Z")]);
    expect(buckets.size).toBe(1);
    expect([...buckets.values()][0]?.total).toBe(2);
  });
});

describe("computeTransitions", () => {
  it("returns no transitions when everything succeeded", () => {
    const transitions = computeTransitions([
      ok("2026-04-30T10:00:00Z"),
      ok("2026-04-30T10:05:00Z"),
    ]);
    expect(transitions).toEqual([]);
  });

  it("opens and closes one incident across a fail run", () => {
    const transitions = computeTransitions([
      ok("2026-04-30T10:00:00Z"),
      fail("2026-04-30T10:05:00Z", 503, "service unavailable"),
      fail("2026-04-30T10:10:00Z"),
      ok("2026-04-30T10:15:00Z"),
    ]);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      startedAt: new Date("2026-04-30T10:05:00Z"),
      endedAt: new Date("2026-04-30T10:15:00Z"),
      statusCode: 503,
      errorMessage: "service unavailable",
    });
  });

  it("leaves the last incident open when the run does not recover", () => {
    const transitions = computeTransitions([
      ok("2026-04-30T10:00:00Z"),
      fail("2026-04-30T10:05:00Z"),
      fail("2026-04-30T10:10:00Z"),
    ]);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.endedAt).toBeNull();
  });

  it("detects multiple separate incidents", () => {
    const transitions = computeTransitions([
      fail("2026-04-30T10:00:00Z"),
      ok("2026-04-30T10:05:00Z"),
      fail("2026-04-30T10:10:00Z"),
      ok("2026-04-30T10:15:00Z"),
    ]);
    expect(transitions).toHaveLength(2);
    expect(transitions[0]?.endedAt).toEqual(new Date("2026-04-30T10:05:00Z"));
    expect(transitions[1]?.endedAt).toEqual(new Date("2026-04-30T10:15:00Z"));
  });

  it("sorts results chronologically before walking", () => {
    const transitions = computeTransitions([
      ok("2026-04-30T10:15:00Z"),
      fail("2026-04-30T10:05:00Z"),
      ok("2026-04-30T10:00:00Z"),
      fail("2026-04-30T10:10:00Z"),
    ]);
    expect(transitions).toEqual([
      {
        startedAt: new Date("2026-04-30T10:05:00Z"),
        endedAt: new Date("2026-04-30T10:15:00Z"),
        statusCode: 503,
        errorMessage: "boom",
      },
    ]);
  });

  it("treats an in-window fail run as a continuation when seeded with an open incident", () => {
    const initialOpen = {
      startedAt: new Date("2026-04-30T08:00:00Z"),
      statusCode: 503,
      errorMessage: "old",
    };
    const transitions = computeTransitions(
      [fail("2026-04-30T10:00:00Z"), fail("2026-04-30T10:05:00Z")],
      initialOpen,
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({
      startedAt: initialOpen.startedAt,
      endedAt: null,
      statusCode: 503,
      errorMessage: "old",
    });
  });

  it("closes a seeded open incident at the first in-window success", () => {
    const initialOpen = {
      startedAt: new Date("2026-04-30T08:00:00Z"),
      statusCode: 503,
      errorMessage: "old",
    };
    const transitions = computeTransitions(
      [fail("2026-04-30T10:00:00Z"), ok("2026-04-30T10:05:00Z")],
      initialOpen,
    );
    expect(transitions).toEqual([
      {
        startedAt: initialOpen.startedAt,
        endedAt: new Date("2026-04-30T10:05:00Z"),
        statusCode: 503,
        errorMessage: "old",
      },
    ]);
  });
});
