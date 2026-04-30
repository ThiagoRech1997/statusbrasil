import "server-only";

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

declare global {
  var __sbRedis: Redis | null | undefined;
  var __sbRedisInited: boolean | undefined;
}

export function getRedisClient(): Redis | null {
  if (globalThis.__sbRedisInited) return globalThis.__sbRedis ?? null;
  globalThis.__sbRedisInited = true;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    logger.info(
      "Upstash Redis not configured (UPSTASH_REDIS_REST_URL/_TOKEN absent); rate limiting disabled",
    );
    globalThis.__sbRedis = null;
    return null;
  }

  const client = new Redis({ url, token });
  globalThis.__sbRedis = client;
  return client;
}
