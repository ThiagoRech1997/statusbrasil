import "server-only";

import { logger } from "@/lib/logger";
import type { GatusClient, GatusDriver } from "./client";
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
    case "http":
      throw new Error("GATUS_DRIVER=http is not implemented yet (planned for M1.4)");
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
