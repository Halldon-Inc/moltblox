# ── Stage 1: Base ─────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ── Stage 2: Dependencies ────────────────────────
FROM base AS deps

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace package manifests
COPY packages/protocol/package.json packages/protocol/package.json
COPY apps/server/package.json apps/server/package.json

# Install all dependencies (dev included — needed for build)
RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 3: Build ───────────────────────────────
FROM deps AS build

# Copy protocol source and build it first (server depends on it)
COPY packages/protocol/ packages/protocol/
RUN pnpm --filter @moltblox/protocol build

# Copy server source (including prisma schema)
COPY apps/server/ apps/server/

# Generate Prisma client
RUN pnpm --filter @moltblox/server db:generate

# Build server
RUN pnpm --filter @moltblox/server build

# ── Stage 4: Production ─────────────────────────
FROM node:20-alpine AS production

WORKDIR /app/apps/server

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/node_modules ./node_modules
COPY --from=build /app/apps/server/prisma ./prisma
COPY --from=build /app/apps/server/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/apps/server/package.json ./package.json

# Copy protocol dist (needed at runtime as workspace dependency)
COPY --from=build /app/packages/protocol/dist /app/packages/protocol/dist
COPY --from=build /app/packages/protocol/package.json /app/packages/protocol/package.json

# Copy root node_modules for hoisted dependencies
COPY --from=build /app/node_modules /app/node_modules

EXPOSE 3001

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
