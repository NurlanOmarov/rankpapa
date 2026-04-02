# Use Debian slim — Alpine Chromium hangs on HTTPS proxy CONNECT tunnels with Playwright
FROM node:20-slim AS base
RUN npm install -g pnpm && apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies + bundled Chromium
# (bundled browser fully supports proxy CONNECT/SSL unlike Alpine's system chromium)
RUN npx -y playwright@1.59.0 install --with-deps chromium && rm -rf /var/lib/apt/lists/*

# ── deps stage ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ── build stage ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Generate Prisma client (worker also uses prisma) before build
RUN pnpm --filter @rankpapa/api exec prisma generate

RUN pnpm --filter @rankpapa/shared build
RUN pnpm --filter @rankpapa/worker build

# ── production stage ─────────────────────────────────────────────────────────
FROM base AS runner
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client in the runner for runtime access
# Worker needs the schema from the api app
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm --filter @rankpapa/api exec prisma generate

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

WORKDIR /app/apps/worker

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
