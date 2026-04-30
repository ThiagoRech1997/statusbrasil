import "server-only";

import type { EndpointStatus } from "./schemas";

export interface GatusClient {
  // Each `EndpointStatus.key` MUST match the corresponding `services.slug` in the
  // database. The aggregator joins on this convention and skips unmatched keys.
  listEndpointStatuses(): Promise<EndpointStatus[]>;
}

export type GatusDriver = "stub" | "http";
