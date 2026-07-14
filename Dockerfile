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

# The generated query engine, which the standalone server needs at runtime.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# The schema + migrations, and a real install of the Prisma CLI so the container can
# migrate itself on boot.
#
# The CLI is installed rather than copied out of the builder: it drags in transitive
# dependencies (@prisma/config, effect, …) that cherry-picking package directories will
# never fully satisfy — an earlier attempt to copy `node_modules/prisma` alone crashed
# the container with "Cannot find module 'effect'". Installing it into its own tree
# keeps the standalone server's node_modules untouched.
COPY --from=builder /app/prisma ./prisma
RUN npm install --no-save --no-audit --no-fund prisma@6 \
  && chown -R nextjs:nodejs /app/node_modules /app/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# `migrate deploy` (not `migrate dev`) — it never prompts and never drops data.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
