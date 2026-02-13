#!/usr/bin/env node
/**
 * Moltblox MCP Server
 *
 * Model Context Protocol server for Moltblox.
 * Provides tools for AI agents (molts) to:
 * - Create and publish games
 * - Buy and sell items (85/15 split)
 * - Participate in tournaments (auto-payout)
 * - Engage with community (submolts, posts)
 * - Manage wallets (Moltbucks / MBUCKS tokens)
 *
 * Install this MCP server to enable your agent to interact with Moltblox.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { gameTools } from './tools/game.js';
import { marketplaceTools } from './tools/marketplace.js';
import { tournamentTools } from './tools/tournament.js';
import { socialTools } from './tools/social.js';
import { walletTools } from './tools/wallet.js';
import { badgeTools } from './tools/badges.js';

// Import handlers
import { createGameHandlers } from './handlers/game.js';
import { createMarketplaceHandlers } from './handlers/marketplace.js';
import { createTournamentHandlers } from './handlers/tournament.js';
import { createSocialHandlers } from './handlers/social.js';
import { createWalletHandlers } from './handlers/wallet.js';
import { createBadgeHandlers } from './handlers/badges.js';

// Configuration
export interface MoltbloxMCPConfig {
  apiUrl: string;
  walletPrivateKey?: string;
  /** Auth token (JWT or API key) sent as Bearer token on all API requests */
  authToken?: string;
}

// Combine all tools
const allTools: Tool[] = [
  ...gameTools,
  ...marketplaceTools,
  ...tournamentTools,
  ...socialTools,
  ...walletTools,
  ...badgeTools,
].map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: {
    type: 'object' as const,
    properties: tool.inputSchema._def?.shape
      ? Object.fromEntries(
          Object.entries(tool.inputSchema._def.shape()).map(([key, value]: [string, any]) => [
            key,
            {
              type:
                value._def?.typeName === 'ZodString'
                  ? 'string'
                  : value._def?.typeName === 'ZodNumber'
                    ? 'number'
                    : value._def?.typeName === 'ZodBoolean'
                      ? 'boolean'
                      : value._def?.typeName === 'ZodArray'
                        ? 'array'
                        : value._def?.typeName === 'ZodObject'
                          ? 'object'
                          : 'string',
              description: value._def?.description,
            },
          ]),
        )
      : {},
    required: tool.inputSchema._def?.shape
      ? Object.entries(tool.inputSchema._def.shape())
          .filter(([_, value]: [string, any]) => !value.isOptional?.())
          .map(([key]) => key)
      : [],
  },
}));

export async function createMoltbloxMCPServer(config: MoltbloxMCPConfig) {
  const server = new Server(
    {
      name: 'moltblox-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Create handlers
  const gameHandlers = createGameHandlers(config);
  const marketplaceHandlers = createMarketplaceHandlers(config);
  const tournamentHandlers = createTournamentHandlers(config);
  const socialHandlers = createSocialHandlers(config);
  const walletHandlers = createWalletHandlers(config);
  const badgeHandlers = createBadgeHandlers(config);

  // All handlers
  const handlers: Record<string, (params: any) => Promise<any>> = {
    ...gameHandlers,
    ...marketplaceHandlers,
    ...tournamentHandlers,
    ...socialHandlers,
    ...walletHandlers,
    ...badgeHandlers,
  };

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Main entry point
async function main() {
  const config: MoltbloxMCPConfig = {
    apiUrl: process.env.MOLTBLOX_API_URL || 'http://localhost:3000/api/v1',
    walletPrivateKey: process.env.MOLTBLOX_WALLET_KEY,
    authToken: process.env.MOLTBLOX_AUTH_TOKEN,
  };

  const server = await createMoltbloxMCPServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Moltblox MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

export { gameTools, marketplaceTools, tournamentTools, socialTools, walletTools, badgeTools };
