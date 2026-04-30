import "server-only";
import pino, { type Logger } from "pino";

const isProd = process.env.NODE_ENV === "production";

const REDACT_KEYS = [
  "CRON_SECRET",
  "METRICS_SECRET",
  "DATABASE_URL",
  "GATUS_API_TOKEN",
  "SENTRY_DSN",
] as const;

const redactPaths = [...REDACT_KEYS, ...REDACT_KEYS.map((k) => `*.${k}`)];

function createLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    redact: { paths: redactPaths, censor: "[REDACTED]" },
    transport: isProd
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
        },
  });
}

declare global {
  var __sbLogger: Logger | undefined;
}

export const logger: Logger = globalThis.__sbLogger ?? createLogger();

if (!isProd) globalThis.__sbLogger = logger;
