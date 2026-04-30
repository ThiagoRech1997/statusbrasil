import "server-only";

import { logger } from "@/lib/logger";
import type { GatusClient, GatusDriver } from "./client";
import { createHttpGatusClient } from "./http";
import { createStubGatusClient } from "./stub";

export type { GatusClient, GatusDriver } from "./client";
export type {
  ConditionResult,
  EndpointEvent,
  EndpointResult,
  EndpointStatus,
  EndpointStatuses,
} from "./schemas";
export {
  ConditionResultSchema,
  EndpointEventSchema,
  EndpointResultSchema,
  EndpointStatusesSchema,
  EndpointStatusSchema,
} from "./schemas";

let cached: GatusClient | undefined;

function resolveDriver(): GatusDriver {
  const raw = process.env.GATUS_DRIVER?.trim().toLowerCase();
  if (!raw) return "stub";
  if (raw === "stub" || raw === "http") return raw;
  throw new Error(`Invalid GATUS_DRIVER: ${raw} (expected "stub" or "http")`);
}

function instantiate(driver: GatusDriver): GatusClient {
  switch (driver) {
    case "stub":
      return createStubGatusClient();
    case "http": {
      const baseUrl = process.env.GATUS_API_URL?.trim();
      if (!baseUrl) {
        throw new Error("GATUS_API_URL is required when GATUS_DRIVER=http");
      }
      return createHttpGatusClient({
        baseUrl,
        token: process.env.GATUS_API_TOKEN,
      });
    }
  }
}

export function getGatusClient(): GatusClient {
  if (cached) return cached;
  const driver = resolveDriver();
  const client = instantiate(driver);
  logger.info({ driver }, "gatus client initialized");
  cached = client;
  return client;
}
