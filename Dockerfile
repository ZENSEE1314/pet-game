# syntax=docker/dockerfile:1

# Multi-stage so the runtime image carries no build toolchain, no dev dependencies
# and no source — just the standalone server, which is a fraction of the size and a
# fraction of the attack surface.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- Dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# --- Build ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs must set `output: 'standalone'` for the runtime stage below.
ENV NEXT_TELEMETRY_DISABLED=1

# The build imports src/lib/env.ts, which refuses to load without these. They are
# build-time placeholders only — the real values are injected at runtime by compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-secret-value"
ENV GAME_SESSION_SECRET="build-time-placeholder-secret-value"
ENV QR_TOKEN_SECRET="build-time-placeholder-secret-value"

RUN npx prisma generate
RUN npm run build

# --- Runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Never run the app as root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI + schema, so the container can run migrations on start.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# `migrate deploy` (not `migrate dev`) — it never prompts and never drops data.
#
# The CLI is invoked through its entrypoint rather than via `npx prisma`: the runtime
# stage copies the prisma package but not `node_modules/.bin`, so the bin shim does
# not exist here and `npx` would fail with "prisma: not found".
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
