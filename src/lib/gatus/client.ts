import "server-only";

import type { EndpointStatus } from "./schemas";

export interface GatusClient {
  listEndpointStatuses(): Promise<EndpointStatus[]>;
}

export type GatusDriver = "stub" | "http";
