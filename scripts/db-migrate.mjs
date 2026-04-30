#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const migrationsFolder = resolve(root, "drizzle");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
let exitCode = 0;
try {
  await migrate(drizzle(sql), { migrationsFolder });
  console.log("Migrations applied");
} catch (err) {
  console.error("Migration failed:", err);
  exitCode = 1;
} finally {
  await sql.end();
}
process.exit(exitCode);
