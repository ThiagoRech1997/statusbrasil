import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "./schemas";

export const PUBLIC_CACHE_HEADER_60 = "s-maxage=60, stale-while-revalidate=300";
export const PUBLIC_CACHE_HEADER_300 = "s-maxage=300, stale-while-revalidate=600";

export interface PublicJsonInit {
  status?: number;
  cacheControl?: string;
}

export function publicJson<T>(body: T, init: PublicJsonInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": init.cacheControl ?? PUBLIC_CACHE_HEADER_60,
    },
  });
}

export function apiError(
  status: number,
  code: ApiErrorResponse["code"],
  error: string,
  details?: unknown,
): Response {
  const body: ApiErrorResponse = {
    error,
    code,
    ...(details !== undefined ? { details } : {}),
  };
  return NextResponse.json(body, { status });
}

interface ZodLikeIssue {
  path: PropertyKey[];
  message: string;
}

function isZodLikeError(err: unknown): err is { issues: ZodLikeIssue[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  );
}

export function fieldDetails(err: unknown): Record<string, string[]> | undefined {
  if (!isZodLikeError(err)) return undefined;
  return err.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_";
    const list = acc[key] ?? [];
    list.push(issue.message);
    acc[key] = list;
    return acc;
  }, {});
}

export function zodValidationError(err: unknown, message = "invalid query parameters"): Response {
  return apiError(400, "validation_error", message, fieldDetails(err));
}
