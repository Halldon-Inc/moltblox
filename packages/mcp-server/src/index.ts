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
import { wagerTools } from './tools/wager.js';
import { userTools } from './tools/users.js';

// Import handlers
import { createGameHandlers } from './handlers/game.js';
import { createMarketplaceHandlers } from './handlers/marketplace.js';
import { createTournamentHandlers } from './handlers/tournament.js';
import { createSocialHandlers } from './handlers/social.js';
import { createWalletHandlers } from './handlers/wallet.js';
import { createBadgeHandlers } from './handlers/badges.js';
import { createWagerHandlers } from './handlers/wager.js';
import { createUserHandlers } from './handlers/users.js';

// Configuration
export interface MoltbloxMCPConfig {
  apiUrl: string;
  walletPrivateKey?: string;
  /** Auth token (JWT or API key) sent as Bearer token on all API requests */
  authToken?: string;
}

// Resolve the base Zod type name, unwrapping Optional/Default/Nullable wrappers
function resolveZodType(def: any): string {
  if (!def) return 'string';
  const tn = def.typeName;
  if (tn === 'ZodOptional' || tn === 'ZodDefault' || tn === 'ZodNullable') {
    return resolveZodType(def.innerType?._def);
  }
  if (tn === 'ZodString' || tn === 'ZodEnum' || tn === 'ZodLiteral') return 'string';
  if (tn === 'ZodNumber') return 'number';
  if (tn === 'ZodBoolean') return 'boolean';
  if (tn === 'ZodArray') return 'array';
  if (tn === 'ZodObject') return 'object';
  return 'string';
}

// Resolve description, unwrapping wrappers to find the inner description
function resolveDescription(zodValue: any): string | undefined {
  if (!zodValue?._def) return undefined;
  if (zodValue._def.description) return zodValue._def.description;
  if (zodValue._def.innerType) return resolveDescription(zodValue._def.innerType);
  return undefined;
}

// Safely convert a Zod schema tool definition into an MCP Tool object
function convertTool(tool: { name: string; description: string; inputSchema: any }): Tool {
  try {
    const shapeFn = tool.inputSchema?._def?.shape;
    const shape = typeof shapeFn === 'function' ? shapeFn() : null;

    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (shape && typeof shape === 'object') {
      for (const [key, value] of Object.entries(shape) as [string, any][]) {
        try {
          properties[key] = {
            type: resolveZodType(value?._def),
            description: resolveDescription(value),
          };
          // Check if field is required (not optional)
          if (typeof value?.isOptional === 'function' && !value.isOptional()) {
            required.push(key);
          } else if (!value?.isOptional) {
            // If isOptional doesn't exist, assume required
            required.push(key);
          }
        } catch {
          // Skip fields that fail introspection
          properties[key] = { type: 'string' };
          required.push(key);
        }
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object' as const,
        properties,
        required,
      },
    };
  } catch (err) {
    // Fallback: tool with no parameters
    console.error(`[MCP] Failed to introspect tool "${tool.name}":`, err);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    };
  }
}

// Combine all tools
const rawTools = [
  ...gameTools,
  ...marketplaceTools,
  ...tournamentTools,
  ...socialTools,
  ...walletTools,
  ...badgeTools,
  ...wagerTools,
  ...userTools,
];

const allTools: Tool[] = rawTools.map(convertTool);
console.error(`[MCP] Registered ${allTools.length} tools from ${rawTools.length} definitions`);

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
  const wagerHandlers = createWagerHandlers(config);
  const userHandlers = createUserHandlers(config);

  // All handlers
  const handlers: Record<string, (params: any) => Promise<any>> = {
    ...gameHandlers,
    ...marketplaceHandlers,
    ...tournamentHandlers,
    ...socialHandlers,
    ...walletHandlers,
    ...badgeHandlers,
    ...wagerHandlers,
    ...userHandlers,
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

export {
  gameTools,
  marketplaceTools,
  tournamentTools,
  socialTools,
  walletTools,
  badgeTools,
  wagerTools,
  userTools,
};
