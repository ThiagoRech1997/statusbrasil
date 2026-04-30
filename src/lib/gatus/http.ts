import "server-only";

import type { z } from "zod";
import { logger } from "@/lib/logger";
import type { GatusClient } from "./client";
import { EndpointStatusesSchema } from "./schemas";

const USER_AGENT = "StatusBrasil/1.0 (+https://statusbrasil.org/sobre)";
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;

export class GatusResponseError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GatusResponseError";
    this.status = status;
  }
}

export class GatusValidationError extends Error {
  readonly path: string;
  readonly issues: z.core.$ZodIssue[];

  constructor(path: string, issues: z.core.$ZodIssue[]) {
    super(`Gatus response failed schema validation at ${path}`);
    this.name = "GatusValidationError";
    this.path = path;
    this.issues = issues;
  }
}

export interface CreateHttpGatusClientOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
  retryAttempts?: number;
  retryBaseMs?: number;
}

export function createHttpGatusClient(options: CreateHttpGatusClientOptions): GatusClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? fetch;
  const token = options.token?.trim();
  const retryAttempts = options.retryAttempts ?? RETRY_ATTEMPTS;
  const retryBaseMs = options.retryBaseMs ?? RETRY_BASE_MS;

  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const res = await fetchImpl(url, { headers });
        if (!res.ok) {
          throw new GatusResponseError(`Gatus ${res.status} on ${path}`, res.status);
        }
        const json = await res.json();
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new GatusValidationError(path, parsed.error.issues);
        }
        return parsed.data;
      } catch (err) {
        lastError = err;
        if (!isRetriable(err) || attempt === retryAttempts) throw err;
        const delay = retryBaseMs * 2 ** (attempt - 1);
        logger.warn({ attempt, delay, error: errorMessage(err), path }, "gatus http retry");
        await sleep(delay);
      }
    }
    throw lastError;
  }

  return {
    listEndpointStatuses() {
      return request("/api/v1/endpoints/statuses", EndpointStatusesSchema);
    },
  };
}

function isRetriable(err: unknown): boolean {
  if (err instanceof GatusValidationError) return false;
  if (err instanceof GatusResponseError) {
    return err.status === undefined || err.status >= 500;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
