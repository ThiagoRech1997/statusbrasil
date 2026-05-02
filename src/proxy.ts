import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { isCronExempt, rateLimitedResponse, rateLimitGate } from "@/lib/api/rate-limit-gate";

const intlMiddleware = createMiddleware(routing);

const PLAUSIBLE_HOST = "https://*.plausible.io";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function resolveSentryHost(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    return new URL(dsn).host;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const sentryHost = resolveSentryHost();

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    PLAUSIBLE_HOST,
    isDev ? "'unsafe-eval'" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const connectSrc = [
    "'self'",
    PLAUSIBLE_HOST,
    sentryHost ? `https://${sentryHost}` : null,
    isDev ? "ws:" : null,
    isDev ? "wss:" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function isRateLimitedApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/v1/") || pathname.startsWith("/api/cron/");
}

async function handleApiRequest(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith("/api/cron/") && isCronExempt(request)) {
    return NextResponse.next();
  }
  const decision = await rateLimitGate(request);
  if (decision.allowed) return NextResponse.next();
  return rateLimitedResponse(decision.retryAfterSeconds);
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  if (isRateLimitedApiPath(request.nextUrl.pathname)) {
    return handleApiRequest(request);
  }

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = intlMiddleware(request);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/api/v1/:path*", "/api/cron/:path*"],
};
