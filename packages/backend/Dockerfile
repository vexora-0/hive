# syntax=docker/dockerfile:1

# ─── Builder ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# sharp needs libvips headers when a prebuilt musl binary is unavailable.
RUN apk add --no-cache vips-dev python3 make g++

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /repo

# Manifests first so the dependency layer caches across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/backend/package.json packages/backend/
RUN pnpm install --frozen-lockfile --filter @hive/backend...

COPY packages/backend ./packages/backend
RUN pnpm --filter @hive/backend build

# Drop dev dependencies before copying into the runtime image.
RUN pnpm --filter @hive/backend install --prod --frozen-lockfile

# ─── Runtime ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Runtime libvips for sharp.
RUN apk add --no-cache vips

ENV NODE_ENV=production
WORKDIR /app

# Never run as root.
RUN addgroup -S hive && adduser -S hive -G hive

COPY --from=builder --chown=hive:hive /repo/packages/backend/dist ./dist
COPY --from=builder --chown=hive:hive /repo/packages/backend/node_modules ./node_modules
COPY --from=builder --chown=hive:hive /repo/node_modules ../node_modules
COPY --from=builder --chown=hive:hive /repo/packages/backend/package.json ./package.json

USER hive
EXPOSE 4000

# Uses the dependency-aware /health endpoint, so an instance that cannot reach
# Supabase is marked unhealthy rather than left in rotation.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
