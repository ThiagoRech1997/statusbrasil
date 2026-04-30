# StatusBrasil

[![CI](https://github.com/ThiagoRech1997/statusbrasil/actions/workflows/ci.yml/badge.svg)](https://github.com/ThiagoRech1997/statusbrasil/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](.nvmrc)

Public availability dashboard for Brazilian government services. Tracks uptime, incidents, and degradation across federal portals — official data, raw numbers, no automated value judgments.

Built with Next.js 16 (App Router) and React 19, fully internationalized (PT/EN), released under AGPL-3.0.

## Quickstart

Prerequisites: Node ≥22, [pnpm](https://pnpm.io) 10.33.0 (managed via Corepack — `corepack enable` once).

```bash
pnpm install
pnpm dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000) with the default locale (`pt`) at `/pt`.

## Common tasks

| Task | Command |
| --- | --- |
| Dev server (Turbopack) | `pnpm dev` |
| Production build | `pnpm build` |
| Start built app | `pnpm start` |
| Lint + format check | `pnpm lint` |
| Lint + format autofix | `pnpm format` |
| Typecheck | `pnpm typecheck` |
| Unit tests | `pnpm test` |
| Test watch mode | `pnpm test:watch` |
| Coverage report | `pnpm test:coverage` |
| i18n drift check | `node scripts/i18n-drift.mjs` |
| Generate SQL migration from schema diff | `pnpm db:generate` |
| Apply pending migrations to `DATABASE_URL` | `pnpm db:migrate` |
| Open Drizzle Studio against `DATABASE_URL` | `pnpm db:studio` |
| Push schema to database without migrations (dev only) | `pnpm db:push` |

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in what your environment needs. All variables are optional in development; the **Required** column reflects what production deployments are expected to set. Sensitive keys are auto-redacted by the pino logger — see `src/lib/logger.ts` and use `/add-secret-env` when adding a new secret.

| Variable | Scope | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `GATUS_DRIVER` | server | no | `stub` | Gatus client driver: `stub` (fixtures) or `http` (real instance). |
| `GATUS_API_URL` | server | when `GATUS_DRIVER=http` | — | Base URL of the Gatus instance the HTTP driver reads from. |
| `GATUS_API_TOKEN` | server | when Gatus requires auth | — | Bearer token for the Gatus API. Redacted from logs. |
| `DATABASE_URL` | server | yes (prod) | — | Postgres connection string for derived aggregates (see ADR-0004). Redacted. |
| `REDIS_URL` | server | no | — | Redis cache URL. App fails open and serves uncached responses if absent. Redacted. |
| `CRON_SECRET` | server | yes (prod) | — | Shared secret for the aggregate-refresh cron endpoint. Redacted. |
| `METRICS_SECRET` | server | yes (prod) | — | Shared secret for the metrics scrape endpoint. Redacted. |
| `SENTRY_DSN` | server | no | — | Sentry DSN for Node-runtime error reporting; init skipped if unset. Redacted. |
| `NEXT_PUBLIC_SENTRY_DSN` | client | no | — | Sentry DSN for browser error reporting; init skipped if unset. |
| `NEXT_PUBLIC_SITE_URL` | client | yes (prod) | — | Canonical public URL used to build absolute URLs (sitemap, OpenGraph). |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | client | no | — | Plausible `data-domain`; the analytics script is not loaded when unset. |
| `NEXT_TELEMETRY_DISABLED` | build | no | — | Set to `1` to opt out of Next.js anonymous build telemetry. |
| `LOG_LEVEL` | server | no | `debug` (dev), `info` (prod) | pino log level: `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |

## Project structure

```
src/
  app/
    [locale]/        # locale-segmented pages (pt, en)
    api/             # route handlers (e.g. /api/health)
  i18n/              # next-intl routing + navigation helpers
  lib/               # server-only utilities (logger, gatus client, version)
  proxy.ts           # locale + security headers middleware (Next 16 filename)
messages/
  pt.json            # canonical locale messages
  en.json            # mirror — must match pt.json key structure
docs/
  adr/               # architecture decision records
scripts/
  i18n-drift.mjs     # CI guard against pt/en key divergence
.github/
  workflows/ci.yml   # lint + typecheck + tests + i18n drift
```

## Methodology and architecture

- **Methodology** — how availability is computed and what counts as an incident: see the in-app [Methodology page](src/app/[locale]/) once published; tracked in the project roadmap.
- **Agent guide** — see [`AGENTS.md`](AGENTS.md) for repo conventions, Next 16 traps, and command reference.

### Architecture decisions

The full set lives in [`docs/adr/`](docs/adr/) (see the [ADR README](docs/adr/README.md) for the format).

- [ADR-0001 — Next.js 16 App Router with React Server Components](docs/adr/0001-nextjs-16-app-router-rsc.md)
- [ADR-0002 — Next.js standalone output for Docker](docs/adr/0002-standalone-docker-output.md)
- [ADR-0003 — Gatus as the primary uptime source](docs/adr/0003-gatus-primary-source.md)
- [ADR-0004 — Postgres for aggregates only](docs/adr/0004-postgres-aggregates-only.md)
- [ADR-0005 — Plausible Analytics instead of Google Analytics](docs/adr/0005-plausible-over-ga.md)
- [ADR-0006 — License the project under AGPL-3.0](docs/adr/0006-agpl-3-0.md)
- [ADR-0007 — Biome instead of ESLint + Prettier](docs/adr/0007-biome-over-eslint-prettier.md)
- [ADR-0008 — visx instead of Recharts](docs/adr/0008-visx-over-recharts.md)

## Contributing

Bug reports, feature requests, and patches are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR — it covers commit conventions, the DCO sign-off, and the local dev workflow. All participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Released under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified version of StatusBrasil on a network-accessible service, the AGPL requires you to make the corresponding source available to its users.
