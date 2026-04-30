import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const sphereEnum = pgEnum("sphere", ["federal", "estadual", "municipal"]);

export const incidentSeverityEnum = pgEnum("incident_severity", ["partial", "total"]);

export const services = pgTable("services", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  agency: text("agency").notNull(),
  category: text("category").notNull(),
  sphere: sphereEnum("sphere").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceUptimeHourly = pgTable(
  "service_uptime_hourly",
  {
    serviceSlug: text("service_slug")
      .notNull()
      .references(() => services.slug, { onDelete: "cascade" }),
    hour: timestamp("hour", { withTimezone: true }).notNull(),
    uptimePct: numeric("uptime_pct", { precision: 5, scale: 2 }).notNull(),
    avgLatencyMs: integer("avg_latency_ms").notNull(),
    totalChecks: integer("total_checks").notNull(),
    failedChecks: integer("failed_checks").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceSlug, t.hour] }),
    index("idx_uptime_service_hour").on(t.serviceSlug, t.hour.desc()),
  ],
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceSlug: text("service_slug")
      .notNull()
      .references(() => services.slug, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    statusCode: integer("status_code"),
    errorMessage: text("error_message"),
    severity: incidentSeverityEnum("severity").notNull(),
  },
  (t) => [index("idx_incidents_service").on(t.serviceSlug, t.startedAt.desc())],
);
