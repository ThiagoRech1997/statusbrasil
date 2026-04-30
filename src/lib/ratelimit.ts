import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { logger } from "@/lib/logger";
import { getRedisClient } from "./redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export type RateLimitWindow = `${number} ${"s" | "m" | "h" | "d"}`;

export interface RateLimitConfig {
  requests: number;
  window: RateLimitWindow;
  prefix?: string;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

const limiters = new Map<string, RateLimiter>();
const configs = new Map<string, RateLimitConfig>();

export function getRateLimiter(name: string, config: RateLimitConfig): RateLimiter {
  const existingConfig = configs.get(name);
  if (existingConfig) {
    if (
      existingConfig.requests !== config.requests ||
      existingConfig.window !== config.window ||
      existingConfig.prefix !== config.prefix
    ) {
      throw new Error(
        `getRateLimiter("${name}") called with conflicting config; rename the bucket or unify configs`,
      );
    }
    const cached = limiters.get(name);
    if (cached) return cached;
  }
  configs.set(name, config);

  const redis = getRedisClient();
  if (!redis) {
    const noop = makeFailOpenLimiter(config);
    limiters.set(name, noop);
    return noop;
  }

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    prefix: config.prefix ?? `ratelimit:${name}`,
    analytics: false,
  });

  const limiter: RateLimiter = {
    async limit(identifier) {
      try {
        const r = await ratelimit.limit(identifier);
        return {
          success: r.success,
          limit: r.limit,
          remaining: r.remaining,
          reset: r.reset,
        };
      } catch (err) {
        logger.warn(
          { name, error: err instanceof Error ? err.message : String(err) },
          "ratelimit failing open due to redis error",
        );
        return failOpen(config);
      }
    },
  };
  limiters.set(name, limiter);
  return limiter;
}

function makeFailOpenLimiter(config: RateLimitConfig): RateLimiter {
  return {
    async limit() {
      return failOpen(config);
    },
  };
}

function failOpen(config: RateLimitConfig): RateLimitResult {
  return {
    success: true,
    limit: config.requests,
    remaining: config.requests,
    reset: Date.now(),
  };
}

export function __resetRateLimitersForTest(): void {
  limiters.clear();
  configs.clear();
}
