# 0001. Next.js 16 App Router with React Server Components

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

StatusBrasil renders public availability data for federal services. The shape of the workload is read-heavy, cache-friendly, and SEO-relevant: each page is a compact view over data that lives on the server (Gatus, later Postgres aggregates). The interactive surface is small — a theme toggle, a locale switcher, a few charts — and most of the page can be rendered ahead of time.

We need a framework that:

- Handles internationalized routing (`/pt`, `/en`) without us hand-rolling locale negotiation.
- Lets us keep secrets and data fetching on the server by default, so a Plausible-only client never grows an accidental dependency on a private API key.
- Streams HTML so first paint stays cheap on slow Brazilian mobile connections.
- Has a healthy ecosystem for security headers, observability, and Docker deployment.

The alternative considered was the Pages Router on the same Next.js version. It would have forced `getServerSideProps` plumbing for what App Router gets for free with async server components, and it would have made the locale split (`[locale]` segment, `next-intl` plugin) noticeably more verbose.

## Decision

We build StatusBrasil on **Next.js 16.2.4 (App Router)** with **React 19.2** and React Server Components as the default rendering model.

Concretely: every route lives under `src/app/`, locale-aware pages under `src/app/[locale]/`, and components are server components unless they explicitly opt into `"use client"`. `next-intl` is wired as a plugin in `next.config.ts` and provides routing primitives via `@/i18n/navigation`. Middleware lives in `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`).

## Consequences

- **Easier:** server-only data access (`server-only` package + RSC), partial pre-rendering for the dashboard, streaming, automatic code-splitting, and tight integration with `next-intl` and Sentry.
- **Harder:** `params` and `searchParams` are now `Promise`-typed in Next 16, so layouts and route handlers must `await` them. Anything mistakenly rendered as a server component that touches `window` will break. New contributors must learn the RSC mental model before reaching for `useEffect`.
- **Committed to:** the Next 16 release line and its upgrade cadence, the `output: "standalone"` build mode (see ADR-0002), and the `@/i18n/navigation` re-exports as the single navigation surface.
