import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpGatusClient, GatusResponseError, GatusValidationError } from "./http";
import type { EndpointStatus } from "./schemas";

const VALID_STATUS: EndpointStatus = {
  name: "Receita Federal",
  group: "federal",
  key: "federal_receita",
  results: [],
  events: [],
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

function mockFetch(): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>();
}

function makeClient(
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof createHttpGatusClient>[0]> = {},
) {
  return createHttpGatusClient({
    baseUrl: "https://gatus.example.com",
    fetch: fetchImpl,
    retryBaseMs: 1,
    ...overrides,
  });
}

function callHeaders(fetchMock: ReturnType<typeof mockFetch>, index = 0): Record<string, string> {
  const call = fetchMock.mock.calls.at(index);
  if (!call) throw new Error(`expected fetch call at index ${index}`);
  const init = call[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

function callUrl(fetchMock: ReturnType<typeof mockFetch>, index = 0): string {
  const call = fetchMock.mock.calls.at(index);
  if (!call) throw new Error(`expected fetch call at index ${index}`);
  return String(call[0]);
}

describe("createHttpGatusClient", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls the list endpoint and returns the parsed array", async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse([VALID_STATUS]));
    const client = makeClient(fetchMock);

    const result = await client.listEndpointStatuses();

    expect(result).toEqual([VALID_STATUS]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callUrl(fetchMock)).toBe("https://gatus.example.com/api/v1/endpoints/statuses");
  });

  it("trims trailing slashes from baseUrl", async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse([]));
    const client = makeClient(fetchMock, { baseUrl: "https://gatus.example.com///" });

    await client.listEndpointStatuses();

    expect(callUrl(fetchMock)).toBe("https://gatus.example.com/api/v1/endpoints/statuses");
  });

  it("sends the StatusBrasil User-Agent on every request", async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse([]));
    const client = makeClient(fetchMock);

    await client.listEndpointStatuses();

    expect(callHeaders(fetchMock)["User-Agent"]).toBe(
      "StatusBrasil/1.0 (+https://statusbrasil.org/sobre)",
    );
  });

  it("includes Bearer auth when token is provided", async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse([]));
    const client = makeClient(fetchMock, { token: "secret-token" });

    await client.listEndpointStatuses();

    expect(callHeaders(fetchMock).Authorization).toBe("Bearer secret-token");
  });

  it("omits Authorization header when token is empty", async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse([]));
    const client = makeClient(fetchMock, { token: "" });

    await client.listEndpointStatuses();

    expect(callHeaders(fetchMock).Authorization).toBeUndefined();
  });

  it("retries 5xx responses up to 3 attempts then throws", async () => {
    const fetchMock = mockFetch().mockResolvedValue(
      jsonResponse({ error: "boom" }, { status: 503 }),
    );
    const client = makeClient(fetchMock);

    await expect(client.listEndpointStatuses()).rejects.toBeInstanceOf(GatusResponseError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries on transient 5xx and succeeds on the second attempt", async () => {
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse({}, { status: 502 }))
      .mockResolvedValueOnce(jsonResponse([VALID_STATUS]));
    const client = makeClient(fetchMock);

    const result = await client.listEndpointStatuses();

    expect(result).toEqual([VALID_STATUS]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx", async () => {
    const fetchMock = mockFetch().mockResolvedValue(
      jsonResponse({ error: "nope" }, { status: 404 }),
    );
    const client = makeClient(fetchMock);

    await expect(client.listEndpointStatuses()).rejects.toMatchObject({
      name: "GatusResponseError",
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on schema validation failure", async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse({ totally: "wrong" }));
    const client = makeClient(fetchMock);

    const err = await client.listEndpointStatuses().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GatusValidationError);
    expect((err as GatusValidationError).path).toBe("/api/v1/endpoints/statuses");
    expect((err as GatusValidationError).issues.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on network errors thrown by fetch", async () => {
    const fetchMock = mockFetch()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse([VALID_STATUS]));
    const client = makeClient(fetchMock);

    await expect(client.listEndpointStatuses()).resolves.toEqual([VALID_STATUS]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
