import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const slidingWindowMock = vi.fn(() => "sliding-window-stub");
const ratelimitCtorMock = vi.fn();
const getRedisClientMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    class {
      limit = limitMock;
      constructor(args: unknown) {
        ratelimitCtorMock(args);
      }
    },
    { slidingWindow: slidingWindowMock },
  ),
}));

vi.mock("./redis", () => ({
  getRedisClient: getRedisClientMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: loggerWarnMock,
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

async function loadHelper() {
  vi.resetModules();
  return await import("./ratelimit");
}

describe("getRateLimiter", () => {
  beforeEach(() => {
    limitMock.mockReset();
    slidingWindowMock.mockClear();
    ratelimitCtorMock.mockReset();
    getRedisClientMock.mockReset();
    loggerWarnMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("fails open when Upstash is not configured (no warn log)", async () => {
    getRedisClientMock.mockReturnValue(null);
    const { getRateLimiter } = await loadHelper();

    const limiter = getRateLimiter("api", { requests: 30, window: "1 m" });
    const result = await limiter.limit("anon");

    expect(result).toMatchObject({
      success: true,
      limit: 30,
      remaining: 30,
    });
    expect(typeof result.reset).toBe("number");
    expect(ratelimitCtorMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it("returns the underlying Ratelimit response on success", async () => {
    getRedisClientMock.mockReturnValue({});
    limitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 7,
      reset: 1234,
      pending: Promise.resolve(),
    });
    const { getRateLimiter } = await loadHelper();

    const limiter = getRateLimiter("api", { requests: 10, window: "10 s" });
    const result = await limiter.limit("user-1");

    expect(result).toEqual({ success: true, limit: 10, remaining: 7, reset: 1234 });
    expect(slidingWindowMock).toHaveBeenCalledWith(10, "10 s");
    expect(ratelimitCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limiter: "sliding-window-stub",
        prefix: "ratelimit:api",
        analytics: false,
      }),
    );
  });

  it("propagates a real over-limit decision without a warn log", async () => {
    getRedisClientMock.mockReturnValue({});
    limitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 9999,
    });
    const { getRateLimiter } = await loadHelper();

    const limiter = getRateLimiter("api", { requests: 5, window: "1 m" });
    const result = await limiter.limit("user-1");

    expect(result).toEqual({ success: false, limit: 5, remaining: 0, reset: 9999 });
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it("fails open on transport error and warns once", async () => {
    getRedisClientMock.mockReturnValue({});
    limitMock.mockRejectedValue(new Error("upstream 503"));
    const { getRateLimiter } = await loadHelper();

    const limiter = getRateLimiter("api", { requests: 30, window: "1 m" });
    const result = await limiter.limit("user-1");

    expect(result).toMatchObject({ success: true, limit: 30, remaining: 30 });
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock.mock.calls[0]?.[0]).toMatchObject({
      name: "api",
      error: "upstream 503",
    });
  });

  it("caches limiters per name and reuses them", async () => {
    getRedisClientMock.mockReturnValue({});
    limitMock.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 });
    const { getRateLimiter } = await loadHelper();

    const a = getRateLimiter("api", { requests: 10, window: "10 s" });
    const b = getRateLimiter("api", { requests: 10, window: "10 s" });

    expect(a).toBe(b);
    expect(ratelimitCtorMock).toHaveBeenCalledTimes(1);
  });

  it("throws on conflicting config under the same name", async () => {
    getRedisClientMock.mockReturnValue({});
    const { getRateLimiter } = await loadHelper();
    getRateLimiter("api", { requests: 10, window: "10 s" });
    expect(() => getRateLimiter("api", { requests: 20, window: "10 s" })).toThrow(
      /conflicting config/,
    );
  });
});
