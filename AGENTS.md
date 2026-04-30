# StatusBrasil — Agent Guide

Public availability dashboard for Brazilian government services. Next.js 16 App Router, fully internationalized (PT/EN), AGPL-3.0.

## This is NOT the Next.js you know

This repo runs **Next.js 16.2.4** with **React 19.2**. APIs, file conventions, and naming have breaking changes from older majors that may dominate your training data. Before writing Next-specific code, consult `node_modules/next/dist/docs/` (especially `01-app/`) and heed deprecation notices.

Three traps that bite every time:

- Middleware lives at **`src/proxy.ts`**, not `middleware.ts`. The exported function and `config.matcher` shape are unchanged, but the filename moved.
- Route handler params and layout/page `params`/`searchParams` are **`Promise`-typed** — `await params` before destructuring. See `src/app/[locale]/layout.tsx`.
- Navigation imports must come from **`@/i18n/navigation`** (`Link`, `useRouter`, `redirect`, `usePathname`), never `next/link` / `next/navigation` directly, or the locale prefix gets stripped.

## Commands

| Task | Command |
| --- | --- |
| Dev server (Turbopack by default in Next 16) | `pnpm dev` |
| Production build | `pnpm build` |
| Start built app | `pnpm start` |
| Lint + format check | `pnpm lint` |
| Lint + format autofix | `pnpm format` |
| Strict CI lint (fails on warnings) | `pnpm ci` |
| Typecheck | `pnpm typecheck` |
| Docker image (single-arch) | `docker buildx bake app` |
| Docker image (multi-arch, push) | `docker buildx bake multiarch --push` |

No test runner is configured — do not invent one. Verify behavior via `pnpm typecheck` plus the dev server.

Toolchain is pinned: **Node ≥22**, **pnpm 10.33.0** (via Corepack), enforced by `package.json` `engines` and `packageManager`.

## Always-applicable constraints

- **Path alias**: `@/*` → `src/*`. Use `@/...` across feature boundaries instead of relative paths. shadcn aliases (`@/components/ui`, `@/lib/utils`, `@/components`, `@/hooks`, `@/lib`) are pre-wired in `components.json`.
- **Status colors**: for service-status UI (operational/degraded/down), use the semantic tokens `operational` / `degraded` / `down` (and `-foreground` variants) declared in `src/app/globals.css`. Never raw `green-500` / `yellow-500` / `red-500` — breaks dark mode and a11y.
- **i18n source of truth**: locales live in `src/i18n/routing.ts` (`pt`, `en`; default `pt`; `localePrefix: "always"`). All user-facing routes are under `src/app/[locale]/`. `messages/pt.json` is canonical; `messages/en.json` mirrors its structure.
- **Logger**: `src/lib/logger.ts` exports a singleton **pino** logger marked `server-only` — never import from a client component. Sensitive env keys live in `REDACT_KEYS` and must be kept in sync (use `/add-secret-env`).
- **Healthcheck**: `/api/health` is the Docker healthcheck endpoint. Don't remove it or change its `{ status, version, uptime }` shape.
- **Build**: `next.config.ts` sets `output: "standalone"` and is wrapped by `createNextIntlPlugin()`. Both are required by the Dockerfile and i18n loader. `docker-bake.hcl` defines `app` (host arch) and `multiarch` targets, tagged under `ghcr.io/thiagorech/statusbrasil`.

## Code style

Biome (`biome.json`) is the only linter/formatter — no ESLint, no Prettier. Defaults to enforce: double quotes, semicolons, trailing commas, 2-space indent, 100-col lines, organize-imports on save. Run `pnpm format` before committing if your editor doesn't auto-apply.

`tsconfig.json` has `strict` **and** `noUncheckedIndexedAccess` — array/record access yields `T | undefined`. Don't paper over it with `!`; narrow properly.

## Workflow skills

Detailed how-tos for repeatable workflows live in `.claude/skills/` and are loaded only when invoked:

- `/add-route` — scaffold a new locale-segmented page (`src/app/[locale]/<segment>/page.tsx`).
- `/add-i18n-key` — add a translation key to `messages/pt.json` and `messages/en.json` in sync.
- `/check-i18n` — audit key parity between the two message files.
- `/add-shadcn` — install a shadcn/ui component with the project's `base-nova` style and Tailwind v4 conventions.
- `/add-api-route` — scaffold a route handler under `src/app/api/`.
- `/add-secret-env` — extend the pino redact list when introducing a new sensitive env var.
