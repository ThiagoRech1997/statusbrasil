import { describe, expect, it } from "vitest";
import type { IncidentRow } from "@/lib/queries/incidents";
import type { ServiceWithStatus } from "@/lib/queries/services";
import type { HourlyPoint } from "@/lib/queries/uptime";
import { toHourlyPoint, toIncidentItem, toServiceItem } from "./mappers";

describe("toServiceItem", () => {
  it("maps domain camelCase fields to wire snake_case and strips private fields", () => {
    const domain: ServiceWithStatus = {
      slug: "gov-br",
      name: "Portal gov.br",
      agency: "Governo Federal",
      category: "atendimento",
      sphere: "federal",
      url: "https://www.gov.br/",
      description: "x",
      active: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      status: "operational",
      uptime1h: 99.9,
    };

    const item = toServiceItem(domain);
    expect(item).toEqual({
      slug: "gov-br",
      name: "Portal gov.br",
      agency: "Governo Federal",
      category: "atendimento",
      sphere: "federal",
      url: "https://www.gov.br/",
      description: "x",
      status: "operational",
      uptime_1h: 99.9,
    });
    expect(item).not.toHaveProperty("active");
    expect(item).not.toHaveProperty("createdAt");
  });
});

describe("toIncidentItem", () => {
  it("ISO-stringifies dates and renames to snake_case", () => {
    const row: IncidentRow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      serviceSlug: "gov-br",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      endedAt: new Date("2026-04-30T08:30:00Z"),
      durationSeconds: 1800,
      statusCode: 503,
      errorMessage: "boom",
      severity: "partial",
    };
    expect(toIncidentItem(row)).toEqual({
      id: row.id,
      service_slug: "gov-br",
      started_at: "2026-04-30T08:00:00.000Z",
      ended_at: "2026-04-30T08:30:00.000Z",
      duration_seconds: 1800,
      status_code: 503,
      error_message: "boom",
      severity: "partial",
    });
  });

  it("preserves null endedAt as null ended_at", () => {
    const row: IncidentRow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      serviceSlug: "x",
      startedAt: new Date("2026-04-30T08:00:00Z"),
      endedAt: null,
      durationSeconds: null,
      statusCode: null,
      errorMessage: null,
      severity: "total",
    };
    expect(toIncidentItem(row).ended_at).toBeNull();
  });
});

describe("toHourlyPoint", () => {
  it("converts a domain hourly point to wire shape", () => {
    const p: HourlyPoint = {
      hour: new Date("2026-04-30T08:00:00Z"),
      uptimePct: 99.5,
      avgLatencyMs: 200,
      totalChecks: 60,
      failedChecks: 0,
    };
    expect(toHourlyPoint(p)).toEqual({
      hour: "2026-04-30T08:00:00.000Z",
      uptime_pct: 99.5,
      avg_latency_ms: 200,
      total_checks: 60,
      failed_checks: 0,
    });
  });
});
