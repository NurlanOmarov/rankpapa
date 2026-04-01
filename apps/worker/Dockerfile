FROM node:20-alpine AS base
RUN npm install -g pnpm
# Playwright requires chromium dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    udev \
    xvfb \
    dbus \
    mesa-gl \
    mesa-dri-gallium

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ── deps stage ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

# ── build stage ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules

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
