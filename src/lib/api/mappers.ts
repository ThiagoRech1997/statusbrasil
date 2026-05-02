import type { IncidentRow } from "@/lib/queries/incidents";
import type { ServiceWithStatus } from "@/lib/queries/services";
import type { HourlyPoint as DomainHourlyPoint } from "@/lib/queries/uptime";
import type { HourlyPoint as HourlyPointDto, IncidentItem, ServiceItem } from "./schemas";

export function toServiceItem(s: ServiceWithStatus): ServiceItem {
  return {
    slug: s.slug,
    name: s.name,
    agency: s.agency,
    category: s.category,
    sphere: s.sphere,
    url: s.url,
    description: s.description,
    status: s.status,
    uptime_1h: s.uptime1h,
  };
}

export function toIncidentItem(row: IncidentRow): IncidentItem {
  return {
    id: row.id,
    service_slug: row.serviceSlug,
    started_at: row.startedAt.toISOString(),
    ended_at: row.endedAt ? row.endedAt.toISOString() : null,
    duration_seconds: row.durationSeconds,
    status_code: row.statusCode,
    error_message: row.errorMessage,
    severity: row.severity,
  };
}

export function toHourlyPoint(p: DomainHourlyPoint): HourlyPointDto {
  return {
    hour: p.hour.toISOString(),
    uptime_pct: p.uptimePct,
    avg_latency_ms: p.avgLatencyMs,
    total_checks: p.totalChecks,
    failed_checks: p.failedChecks,
  };
}
