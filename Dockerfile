# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Base — pnpm via corepack (version pinned by package.json packageManager field)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

# ──────────────────────────────────────────────────────────────────────────────
# Deps — install with frozen lockfile (cache-friendly: only re-runs on lock change)
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ──────────────────────────────────────────────────────────────────────────────
# Builder — Next.js production build (emits .next/standalone + .next/static)
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# ──────────────────────────────────────────────────────────────────────────────
# Runner — minimal image: only the standalone server + static assets + public
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
