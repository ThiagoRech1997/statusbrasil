import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type Schema = typeof schema;
export type DB = PostgresJsDatabase<Schema>;

declare global {
  // biome-ignore lint/suspicious/noExplicitAny: postgres.js Sql is generic over a row-type map we don't track here
  var __sbSql: Sql<any> | undefined;
  var __sbDb: DB | undefined;
}

function init(): DB {
  if (globalThis.__sbDb) return globalThis.__sbDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 10, idle_timeout: 20 });
  const instance = drizzle(sql, { schema });
  globalThis.__sbSql = sql;
  globalThis.__sbDb = instance;
  return instance;
}

export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const target = init();
    const value = Reflect.get(target, prop);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
