# 0002. Next.js standalone output for Docker

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

StatusBrasil ships as a container image to GHCR and runs behind a reverse proxy. The default `next build` output assumes the full `node_modules` tree is present at runtime — for our footprint that is roughly half a gigabyte of dependencies, most of which are build-only (TypeScript, Biome, Vitest, Tailwind toolchain).

We want:

- Small images for cheap pulls and faster cold starts.
- Reproducible runtime surface area, so a CVE in a dev-only package doesn't appear in the deployed image.
- A single `CMD` that works without `pnpm` or `next` being installed in the runner stage.

## Decision

We set `output: "standalone"` in `next.config.ts`. The Docker build copies `.next/standalone`, `.next/static`, and `public/` from the builder stage into a clean `node:22-alpine` runner stage and runs `node server.js`.

The Dockerfile is a multi-stage build: `base` installs pnpm via Corepack, `deps` resolves the lockfile, `builder` runs `pnpm build`, and `runner` is a minimal stage that does not include the build toolchain. The healthcheck calls `/api/health`, which is the contract documented in `AGENTS.md`.

## Consequences

- **Easier:** runner image stays small and self-contained, BuildKit cache mounts on the pnpm store make rebuilds fast, and the multi-arch bake target (`docker buildx bake multiarch`) can ship `linux/amd64` and `linux/arm64` from one definition.
- **Harder:** anything that depends on files outside of what `next build` traces (custom scripts, non-imported assets) needs to be copied explicitly into the runner stage. `outputFileTracingRoot` would have to be tuned if we ever go monorepo.
- **Committed to:** keeping `output: "standalone"` in `next.config.ts` and the `/api/health` route contract (`{ status, version, uptime }`); both are load-bearing for the Dockerfile's `HEALTHCHECK` and for the deploy pipeline. ADR-0001 (App Router) sits upstream of this decision; ADR-0006 (AGPL-3.0) governs the source-availability obligation that ships alongside the image.
