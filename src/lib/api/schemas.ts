import { z } from "zod";
import type { IncidentSeverity as DomainIncidentSeverity } from "@/lib/queries/incidents";
import type { CurrentStatus as DomainCurrentStatus } from "@/lib/queries/services";

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 25;

const Slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "must be lowercase letters, digits or hyphens");
const NonEmptyString = z.string().min(1);
const IsoDateString = z.string().datetime({ offset: true });
const Limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT);
export const Cursor = z.string().min(1).max(512);

export const Sphere = z.enum(["federal", "estadual", "municipal"]);
export type Sphere = z.infer<typeof Sphere>;

export const CurrentStatus = z.enum(["operational", "degraded", "down", "unknown"]);
export type CurrentStatus = z.infer<typeof CurrentStatus>;

export const IncidentSeverity = z.enum(["partial", "total"]);
export type IncidentSeverity = z.infer<typeof IncidentSeverity>;

export const IncidentStatusFilter = z.enum(["open", "closed", "all"]);
export type IncidentStatusFilter = z.infer<typeof IncidentStatusFilter>;

export const ApiErrorCode = z.enum([
  "bad_request",
  "validation_error",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "internal_error",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorResponse = z.object({
  error: NonEmptyString,
  code: ApiErrorCode,
  details: z.unknown().optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;

export const ServiceItem = z.object({
  slug: Slug,
  name: NonEmptyString,
  agency: NonEmptyString,
  category: NonEmptyString,
  sphere: Sphere,
  url: z.string().url(),
  description: z.string().nullable(),
  status: CurrentStatus,
  uptime1h: z.number().min(0).max(100).nullable(),
});
export type ServiceItem = z.infer<typeof ServiceItem>;

const ServicesSort = z.enum(["uptime", "name", "category", "status"]).default("name");
export type ServicesSort = z.infer<typeof ServicesSort>;

export const ServicesQueryParams = z.object({
  category: NonEmptyString.optional(),
  status: CurrentStatus.optional(),
  sort: ServicesSort,
  cursor: Cursor.optional(),
  limit: Limit,
});
export type ServicesQueryParams = z.infer<typeof ServicesQueryParams>;

export const ServicesResponse = z.object({
  data: z.array(ServiceItem),
  next_cursor: z.string().optional(),
});
export type ServicesResponse = z.infer<typeof ServicesResponse>;

export const IncidentItem = z.object({
  id: z.string().uuid(),
  serviceSlug: Slug,
  startedAt: IsoDateString,
  endedAt: IsoDateString.nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  statusCode: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  severity: IncidentSeverity,
});
export type IncidentItem = z.infer<typeof IncidentItem>;

export const ServiceDetailResponse = z.object({
  service: ServiceItem,
  uptime24h: z.number().min(0).max(100).nullable(),
  downtime24hSeconds: z.number().int().nonnegative(),
  recentIncidents: z.array(IncidentItem),
});
export type ServiceDetailResponse = z.infer<typeof ServiceDetailResponse>;

export const HistoryQueryParams = z
  .object({
    from: IsoDateString,
    to: IsoDateString,
  })
  .refine((v) => Date.parse(v.to) >= Date.parse(v.from), {
    message: "to must be greater than or equal to from",
    path: ["to"],
  });
export type HistoryQueryParams = z.infer<typeof HistoryQueryParams>;

export const HourlyPoint = z.object({
  hour: IsoDateString,
  uptimePct: z.number().min(0).max(100),
  avgLatencyMs: z.number().int().nonnegative(),
  totalChecks: z.number().int().nonnegative(),
  failedChecks: z.number().int().nonnegative(),
});
export type HourlyPoint = z.infer<typeof HourlyPoint>;

export const HistoryResponse = z.object({
  slug: Slug,
  range: z.object({ from: IsoDateString, to: IsoDateString }),
  points: z.array(HourlyPoint),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;

export const IncidentsQueryParams = z.object({
  service: Slug.optional(),
  status: IncidentStatusFilter.default("all"),
  severity: IncidentSeverity.optional(),
  from: IsoDateString.optional(),
  to: IsoDateString.optional(),
  cursor: Cursor.optional(),
  limit: Limit,
});
export type IncidentsQueryParams = z.infer<typeof IncidentsQueryParams>;

export const IncidentsResponse = z.object({
  data: z.array(IncidentItem),
  next_cursor: z.string().optional(),
});
export type IncidentsResponse = z.infer<typeof IncidentsResponse>;

export function parseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams,
): z.infer<T> {
  const entries: Record<string, string> = {};
  for (const [key, value] of searchParams) entries[key] = value;
  return schema.parse(entries);
}

// Drift guards: if either alias fails to compile, the enum literals here have
// diverged from the types returned by src/lib/queries — fix both.
type _Eq<X, Y> = (X extends Y ? true : false) & (Y extends X ? true : false);
type _Assert<T extends true> = T;
type _CurrentStatusDriftGuard = _Assert<_Eq<CurrentStatus, DomainCurrentStatus>>;
type _IncidentSeverityDriftGuard = _Assert<_Eq<IncidentSeverity, DomainIncidentSeverity>>;

export type { _CurrentStatusDriftGuard, _IncidentSeverityDriftGuard };
