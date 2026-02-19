# Merge Tracking: Morte-Bianca Commit f83e2e7

**Date**: 2026-02-11
**Source**: github.com/Morte-Bianca/moltblox (fork of Halldon-Inc/moltblox)
**Commit**: f83e2e7fc528e2304fa32fdcdf11107e9e4ad02d
**Safe revert point**: 3be89a797b2466265de9817a29f5611660342c88

## Revert Command

```bash
git revert <merge-commit-sha>
# OR hard revert to safe point:
git reset --hard 3be89a797b2466265de9817a29f5611660342c88
git push --force-with-lease origin main
```

## All 33 Changed Files

### Category: Chain/Network Switch (HIGH RISK)

| #   | File                          | Change                                                                                         |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | `apps/web/.env.example`       | Default chain changed from Base Sepolia (84532) to Hoodi (560048), added custom chain env vars |
| 2   | `apps/web/lib/wagmi.ts`       | Added `defineChain` for custom EVM chains, Hoodi as default                                    |
| 3   | `contracts/.env.example`      | Added Hoodi RPC, chain ID, Etherscan keys                                                      |
| 4   | `contracts/hardhat.config.ts` | Added `eth-hoodi` network, refactored network config to support Hoodi                          |
| 5   | `contracts/package.json`      | Added `deploy:eth-hoodi` script                                                                |
| 6   | `contracts/scripts/deploy.ts` | Added Hoodi verification support, treasury address validation                                  |
| 7   | `docs/deployment-tracking.md` | NEW: 179-line deployment checklist targeting Hoodi (not Base)                                  |

### Category: Production Safety (HIGH RISK)

| #   | File                     | Change                                                                                                              |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 8   | `apps/server/Dockerfile` | `prisma migrate deploy` replaced with `prisma db push` (can drop data), added build deps, copies tsconfig.base.json |

### Category: Server Code Changes (MEDIUM RISK)

| #   | File                               | Change                                                               |
| --- | ---------------------------------- | -------------------------------------------------------------------- |
| 9   | `apps/server/package.json`         | Added `"type": "module"` (switches to ESM)                           |
| 10  | `apps/server/src/index.ts`         | Redis type import fix, "already connected" error handling            |
| 11  | `apps/server/src/lib/redis.ts`     | Named import `{ Redis }` instead of default, error type annotation   |
| 12  | `apps/server/src/routes/auth.ts`   | Added `token` to moltbook auth response                              |
| 13  | `apps/server/src/routes/wallet.ts` | Added on-chain balance lookup via ethers.js, env-driven network name |
| 14  | `apps/server/src/schemas/games.ts` | Game ID validation changed from `uuid()` to `cuid()`                 |
| 15  | `apps/server/prisma/seed.ts`       | Hardcoded demo bot API key, hashed into seed data                    |

### Category: MCP Server (MEDIUM RISK)

| #   | File                                              | Change                                                                                                |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 16  | `packages/mcp-server/package.json`                | Added `ws` and `@types/ws` dependencies                                                               |
| 17  | `packages/mcp-server/src/index.ts`                | Added wsUrl, apiKey config; default apiUrl changed to localhost:3001/api/v1                           |
| 18  | `packages/mcp-server/src/handlers/game.ts`        | All URL paths changed, X-API-Key header added, play_game rewritten to WebSocket, wasmCode to wasmUrl  |
| 19  | `packages/mcp-server/src/handlers/marketplace.ts` | URL paths changed, X-API-Key header added, response field mapping                                     |
| 20  | `packages/mcp-server/src/handlers/social.ts`      | URL paths changed, X-API-Key header added                                                             |
| 21  | `packages/mcp-server/src/handlers/tournament.ts`  | URL paths changed, X-API-Key header added, spectate_match and add_to_prize_pool throw "not supported" |
| 22  | `packages/mcp-server/src/handlers/wallet.ts`      | URL paths changed, X-API-Key header added, transfer returns intent instead of txHash                  |
| 23  | `packages/mcp-server/src/tools/game.ts`           | wasmCode to wasmUrl, added search param, status enum, screenshots                                     |
| 24  | `packages/mcp-server/src/tools/wallet.ts`         | Transfer response: txHash to transferId, added status field                                           |

### Category: Env/Config (LOW RISK)

| #   | File                       | Change                                                         |
| --- | -------------------------- | -------------------------------------------------------------- |
| 25  | `.env.production.example`  | Added MOLTBOOK_API_URL and MOLTBOOK_APP_KEY                    |
| 26  | `apps/server/.env.example` | Added EVM_RPC_URL, EVM_NETWORK_NAME (keeps backward compat)    |
| 27  | `docker-compose.yml`       | Ports made configurable via POSTGRES_PORT, REDIS_PORT env vars |

### Category: Dev Tooling (LOW RISK)

| #   | File                          | Change                                                              |
| --- | ----------------------------- | ------------------------------------------------------------------- |
| 28  | `package.json`                | Added local:infra, local:server, local:web scripts                  |
| 29  | `scripts/local/dev-infra.sh`  | NEW: starts Postgres + Redis via docker compose with port detection |
| 30  | `scripts/local/dev-server.sh` | NEW: sets env vars, runs db:push + seed, starts dev server          |
| 31  | `scripts/local/dev-web.sh`    | NEW: starts Next.js dev server                                      |

### Category: Binary/Docs

| #   | File                            | Change                                    |
| --- | ------------------------------- | ----------------------------------------- |
| 32  | `Moltblox_Deployment_Guide.pdf` | NEW: binary PDF (cannot be code-reviewed) |

### Category: Lockfile

| #   | File             | Change                 |
| --- | ---------------- | ---------------------- |
| 33  | `pnpm-lock.yaml` | ws and @types/ws added |

## Flagged Concerns

1. **Chain target**: Defaults switched from Base to Ethereum Hoodi
2. **DB safety**: `prisma db push` in production Dockerfile
3. **Auth surface**: X-API-Key header added across all MCP handlers
4. **WASM trust**: wasmCode (inline) changed to wasmUrl (external URL)
5. **Schema validation**: uuid() to cuid() for game IDs
6. **Unknown contributor**: Fork created same day as commit
