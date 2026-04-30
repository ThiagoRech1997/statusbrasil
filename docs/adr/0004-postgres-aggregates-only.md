# 0004. Postgres for aggregates only

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

Gatus (ADR-0003) holds raw probe results — every check, every response time, every error string. Its API is suitable for "what does the dashboard show right now" but not for "what was the 30-day uptime of e-CAC during business hours" or "show a year-over-year availability trend." Querying Gatus' raw history every page load would be slow, expensive, and forces every reader through the probe service.

We need a place to store **derived** time series: hourly/daily/monthly availability percentages, p50/p95 latency rollups, incident summaries, and historical events that outlive Gatus' retention window.

Options considered:

- **Keep everything in Gatus' storage** — viable for the live view, fails on retention and query flexibility.
- **Time-series database** (InfluxDB, TimescaleDB, ClickHouse) — overkill for the cardinality we expect (≈50 endpoints, hourly buckets) and adds an unfamiliar operations surface.
- **Postgres for aggregates** — the team already runs Postgres for other projects, the data volume is small, the query patterns are well-served by indexes and materialized views, and TimescaleDB is available as an extension if we ever need it.

## Decision

**Postgres is the application database for derived aggregates only.** Raw probe results stay in Gatus and are not mirrored. A scheduled job — to be specified in ADR-0009 — reads Gatus' history, computes rollups, and writes them to Postgres. The dashboard reads aggregates from Postgres and live status from Gatus.

Postgres is not yet wired up at the time of this decision. The schema, driver, and migration tooling are deferred to a later milestone; this ADR commits to the architectural split, not to a specific ORM or hosting choice.

## Consequences

- **Easier:** dashboard queries hit a database optimized for the read pattern they need. Long retention is independent of Gatus' storage limits. Operationally, we only need one familiar database for everything that isn't probe-state.
- **Harder:** aggregates are a separate concern from probing — there is now a pipeline (Gatus → cron → Postgres) that can drift, lag, or fail silently. The cron job that writes aggregates becomes a tier-1 component (covered in ADR-0009).
- **Committed to:** Postgres as the only relational store, "raw data lives in Gatus, derived data lives in Postgres" as an invariant, and treating Postgres as a cache of aggregates that can be rebuilt from Gatus history if it is ever lost.
