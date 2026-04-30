# 0003. Gatus as the primary uptime source

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

StatusBrasil reports availability for Brazilian government services. We need a probe layer that performs scheduled HTTP checks, evaluates conditions (status code, response time, body match), exposes results via API, and is operationally cheap to run on a single small VM.

The realistic options were:

- **Build it ourselves** — a Next.js cron-ish loop hitting endpoints and writing rows to Postgres. Reinvents an entire category and forces us to operate the scheduler.
- **Hosted SaaS** (UptimeRobot, Better Uptime, Checkly) — quick to start, but pricing scales per check and per minute, the data sits with a third party, and we lose the ability to run probes from inside Brazil.
- **TwTeleStatus / Cachet / Statping** — older, less actively maintained, and oriented toward incident communication rather than synthetic probing.
- **[Gatus](https://github.com/TwiN/gatus)** — single Go binary, declarative YAML, built-in conditions, native JSON API, Prometheus exporter, supports DNS/TCP/ICMP/HTTP/SSH probes, AGPL-friendly licensing.

Gatus is the only option that gives us programmatic data over an HTTP API without a per-check bill, runs entirely under our control, and is mature enough that we don't take on maintenance of the probe engine.

## Decision

**Gatus is the primary source of truth for raw availability data.** StatusBrasil treats Gatus as an external service: a co-located instance exposes its endpoints API, and our app reads from it via `GatusClient` (`src/lib/gatus/client.ts`), an interface with two drivers: `stub` for development/tests and `http` for production.

The driver is selected at runtime via the `GATUS_DRIVER` env var. The Zod-validated schemas in `src/lib/gatus/schemas.ts` are the contract — anything that doesn't conform is rejected at the boundary.

## Consequences

- **Easier:** we offload probe scheduling, retry logic, and metric collection. The dashboard becomes a presentation layer over an already-sliced JSON API. Local development stays offline because `GATUS_DRIVER=stub` returns deterministic fixtures.
- **Harder:** Gatus' YAML is the operational surface for "which endpoints are watched" — adding a new monitored service is a config change in the Gatus deployment, not a code change here. We are also coupled to its endpoint shape; a breaking change upstream means schema migration in `schemas.ts`.
- **Committed to:** the `GatusClient` interface as the only path from app code to probe data, and to keeping the `stub` driver in lockstep with the real schema so tests don't drift. Aggregates derived from Gatus history live in Postgres (see ADR-0004); the cron strategy that feeds them is deferred to ADR-0009 (M1.7).
