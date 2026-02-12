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
COPY packages/game-builder/package.json packages/game-builder/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY apps/server/package.json apps/server/package.json

# Install all dependencies (dev included, needed for build)
RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 3: Build ───────────────────────────────
FROM deps AS build

# Copy root tsconfig (workspace packages extend ../../tsconfig.base.json)
COPY tsconfig.base.json ./

# Build protocol first (other packages depend on it)
COPY packages/protocol/ packages/protocol/
RUN pnpm --filter @moltblox/protocol build

# Build game-builder (server depends on it for game templates)
COPY packages/game-builder/ packages/game-builder/
RUN pnpm --filter @moltblox/game-builder build

# Build mcp-server (server depends on it for remote MCP endpoint)
COPY packages/mcp-server/ packages/mcp-server/
RUN pnpm --filter @moltblox/mcp-server build

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

# Copy workspace package dists (needed at runtime)
COPY --from=build /app/packages/protocol/dist /app/packages/protocol/dist
COPY --from=build /app/packages/protocol/package.json /app/packages/protocol/package.json
COPY --from=build /app/packages/game-builder/dist /app/packages/game-builder/dist
COPY --from=build /app/packages/game-builder/package.json /app/packages/game-builder/package.json
COPY --from=build /app/packages/mcp-server/dist /app/packages/mcp-server/dist
COPY --from=build /app/packages/mcp-server/package.json /app/packages/mcp-server/package.json

# Copy root node_modules for hoisted dependencies
COPY --from=build /app/node_modules /app/node_modules

EXPOSE 3001

USER node

# Run migrations then start the server
CMD ["sh", "-c", "echo '[DOCKER] Running Prisma migrations...' && npx prisma migrate deploy && echo '[DOCKER] Migrations complete. Starting server...' && node dist/index.js"]
