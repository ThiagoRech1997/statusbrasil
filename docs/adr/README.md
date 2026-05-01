# Architecture Decision Records

This directory holds Architecture Decision Records (ADRs) for StatusBrasil. An ADR captures a significant technical decision, the context that drove it, and its consequences — so that future contributors can understand *why* the codebase looks the way it does, not just *what* it does.

## Format

Each ADR is a single Markdown file named `NNNN-short-title.md` (zero-padded, monotonically increasing). Use the template below.

```markdown
# NNNN. Short, descriptive title

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD

## Context

What problem are we solving? What constraints, prior decisions, or external forces are in play?

## Decision

The decision, stated as a single declarative sentence. Then a short paragraph elaborating on what we are doing and how.

## Consequences

What becomes easier, what becomes harder, what we are now committed to, and what we explicitly accept as trade-offs.
```

## Conventions

- Once an ADR is **Accepted**, do not edit it in place. Supersede it with a new ADR that references the old one and flip the old one to **Superseded by ADR-XXXX**.
- Keep ADRs short. If you need more than two screens, split the decision.
- Link to ADRs from `README.md` and `AGENTS.md` whenever a future reader would benefit from the rationale.

## Index

- [ADR-0001 — Next.js 16 App Router with React Server Components](0001-nextjs-16-app-router-rsc.md)
- [ADR-0002 — Next.js standalone output for Docker](0002-standalone-docker-output.md)
- [ADR-0003 — Gatus as the primary uptime source](0003-gatus-primary-source.md)
- [ADR-0004 — Postgres for aggregates only](0004-postgres-aggregates-only.md)
- [ADR-0005 — Plausible Analytics instead of Google Analytics](0005-plausible-over-ga.md)
- [ADR-0006 — License the project under AGPL-3.0](0006-agpl-3-0.md)
- [ADR-0007 — Biome instead of ESLint + Prettier](0007-biome-over-eslint-prettier.md)
- [ADR-0008 — visx instead of Recharts](0008-visx-over-recharts.md)
- [ADR-0009 — Cron strategy for Gatus → Postgres aggregates](0009-cron-strategy.md)
