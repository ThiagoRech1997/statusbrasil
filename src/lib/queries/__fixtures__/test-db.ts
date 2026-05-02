import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type { DB } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export interface TestDb {
  db: DB;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

const MIGRATION_FILE = "drizzle/0000_m1_2_services_uptime_incidents.sql";

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  const drz = drizzle(pg, { schema });

  const ddl = readFileSync(resolve(process.cwd(), MIGRATION_FILE), "utf-8");
  const statements = ddl
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await pg.exec(stmt);
  }

  return {
    db: drz as unknown as DB,
    async reset() {
      await drz.execute(
        sql`TRUNCATE TABLE incidents, service_uptime_hourly, services RESTART IDENTITY CASCADE`,
      );
    },
    async close() {
      await pg.close();
    },
  };
}

export interface SeedServiceInput {
  slug: string;
  name?: string;
  agency?: string;
  category?: string;
  sphere?: "federal" | "estadual" | "municipal";
  url?: string;
  description?: string | null;
  active?: boolean;
}

export async function seedService(db: DB, input: SeedServiceInput): Promise<void> {
  await db.insert(schema.services).values({
    slug: input.slug,
    name: input.name ?? input.slug,
    agency: input.agency ?? "Test Agency",
    category: input.category ?? "atendimento",
    sphere: input.sphere ?? "federal",
    url: input.url ?? `https://example.test/${input.slug}`,
    description: input.description ?? null,
    active: input.active ?? true,
  });
}

export interface SeedHourlyInput {
  serviceSlug: string;
  hour: Date;
  uptimePct?: number;
  avgLatencyMs?: number;
  totalChecks?: number;
  failedChecks?: number;
}

export async function seedHourly(db: DB, input: SeedHourlyInput): Promise<void> {
  await db.insert(schema.serviceUptimeHourly).values({
    serviceSlug: input.serviceSlug,
    hour: input.hour,
    uptimePct: (input.uptimePct ?? 100).toFixed(2),
    avgLatencyMs: input.avgLatencyMs ?? 200,
    totalChecks: input.totalChecks ?? 60,
    failedChecks: input.failedChecks ?? 0,
  });
}

export interface SeedIncidentInput {
  serviceSlug: string;
  startedAt: Date;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  statusCode?: number | null;
  errorMessage?: string | null;
  severity?: "partial" | "total";
}

export async function seedIncident(db: DB, input: SeedIncidentInput): Promise<string> {
  const [row] = await db
    .insert(schema.incidents)
    .values({
      serviceSlug: input.serviceSlug,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      durationSeconds:
        input.durationSeconds ??
        (input.endedAt
          ? Math.max(0, Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000))
          : null),
      statusCode: input.statusCode ?? null,
      errorMessage: input.errorMessage ?? null,
      severity: input.severity ?? "partial",
    })
    .returning({ id: schema.incidents.id });
  if (!row) throw new Error("seedIncident: insert returned no row");
  return row.id;
}
