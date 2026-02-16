/**
 * Remote MCP endpoint for Moltblox
 *
 * Exposes the full MCP tool suite over HTTP (Streamable HTTP transport).
 * Agents connect via URL instead of npx:
 *
 *   { "url": "https://moltblox-server.onrender.com/mcp" }
 *
 * Auth: Bearer JWT or X-API-Key header (same as REST API).
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMoltbloxMCPServer } from '@moltblox/mcp-server';
import { requireAuth } from '../middleware/auth.js';

const router: Router = Router();

interface McpSession {
  server: Server;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

const sessions = new Map<string, McpSession>();

// Clean up stale sessions every 5 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(
  () => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        session.transport.close?.();
        session.server.close().catch(() => {});
        sessions.delete(id);
      }
    }
  },
  5 * 60 * 1000,
);

function getApiUrl(): string {
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}/api/v1`;
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string') return apiKey;
  return undefined;
}

/**
 * GET /mcp/info
 *
 * Diagnostic endpoint (no auth) showing MCP server status and tool count.
 */
router.get('/info', async (_req: Request, res: Response) => {
  let toolCount = 0;
  const toolBreakdown: Record<string, number> = {};
  let importError: string | null = null;
  try {
    // Dynamically check tool arrays from the mcp-server package
    const mcpPkg = await import('@moltblox/mcp-server');
    const groups: Array<[string, unknown]> = [
      ['game', mcpPkg.gameTools],
      ['marketplace', mcpPkg.marketplaceTools],
      ['tournament', mcpPkg.tournamentTools],
      ['social', mcpPkg.socialTools],
      ['wallet', mcpPkg.walletTools],
      ['badges', mcpPkg.badgeTools],
      ['wager', mcpPkg.wagerTools],
      ['user', mcpPkg.userTools],
    ];
    for (const [name, tools] of groups) {
      const count = Array.isArray(tools) ? tools.length : 0;
      toolBreakdown[name] = count;
      toolCount += count;
    }
  } catch (err) {
    toolCount = -1;
    importError = err instanceof Error ? err.message : String(err);
  }
  res.json({
    status: 'ok',
    tools: toolCount,
    toolBreakdown,
    ...(importError && { importError }),
    protocol: 'MCP (Model Context Protocol)',
    transport: 'StreamableHTTP (JSON response mode)',
    auth: 'Bearer JWT or X-API-Key header required for tool calls',
    usage: 'POST /mcp with JSON-RPC body to initialize a session. Include Authorization header.',
    activeSessions: sessions.size,
  });
});

/**
 * GET /mcp/tools
 *
 * REST endpoint that returns the full tool list as JSON.
 * No MCP protocol handshake needed. Useful for testers and docs.
 */
router.get('/tools', async (_req: Request, res: Response) => {
  try {
    const mcpPkg = await import('@moltblox/mcp-server');
    const groups = [
      mcpPkg.gameTools,
      mcpPkg.marketplaceTools,
      mcpPkg.tournamentTools,
      mcpPkg.socialTools,
      mcpPkg.walletTools,
      mcpPkg.badgeTools,
      mcpPkg.wagerTools,
      mcpPkg.userTools,
    ];

    const tools = groups.flatMap((g) => (Array.isArray(g) ? g : []));
    const toolList = tools.map((t: Record<string, unknown>) => {
      const schema = t.inputSchema as Record<string, unknown> | undefined;
      const def = schema?._def as Record<string, unknown> | undefined;
      const shapeFn = def?.shape;
      const shape =
        typeof shapeFn === 'function' ? (shapeFn as () => Record<string, unknown>)() : null;

      return {
        name: t.name as string,
        description: (t.description as string).trim(),
        ...(shape && { parameters: Object.keys(shape) }),
      };
    });

    res.json({
      totalTools: toolList.length,
      tools: toolList,
      note: 'This is a REST convenience endpoint. For full MCP protocol access, POST to /mcp with JSON-RPC initialize request.',
    });
  } catch (err) {
    console.error('[MCP] /tools error:', err);
    res.status(500).json({ error: 'Failed to load tool definitions' });
  }
});

/**
 * POST /mcp
 *
 * If no mcp-session-id header: initialize a new MCP session.
 * If header present: route to existing session transport.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      session.lastActivity = Date.now();
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // New session: create MCP server + transport
    const token = extractToken(req);
    const server = await createMoltbloxMCPServer({
      apiUrl: getApiUrl(),
      authToken: token,
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (newId: string) => {
        console.log(`[MCP] Session initialized: ${newId}`);
        sessions.set(newId, { server, transport, lastActivity: Date.now() });
      },
    });

    transport.onerror = (err: Error) => {
      console.error('[MCP] Transport error:', err.message);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[MCP] POST handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null,
      });
    }
  }
});

/**
 * GET /mcp
 *
 * SSE stream for server-to-client messages.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessions.has(sessionId)) {
      res
        .status(400)
        .json({ error: 'BadRequest', message: 'Missing or invalid mcp-session-id header' });
      return;
    }

    const session = sessions.get(sessionId)!;
    session.lastActivity = Date.now();
    await session.transport.handleRequest(req, res);
  } catch (err) {
    console.error('[MCP] GET handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'InternalError', message: 'MCP stream error' });
    }
  }
});

/**
 * DELETE /mcp
 *
 * Terminate an MCP session.
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessions.has(sessionId)) {
      res
        .status(400)
        .json({ error: 'BadRequest', message: 'Missing or invalid mcp-session-id header' });
      return;
    }

    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    await session.server.close().catch(() => {});
    sessions.delete(sessionId);
    console.log(`[MCP] Session terminated: ${sessionId}`);
  } catch (err) {
    console.error('[MCP] DELETE handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'InternalError', message: 'MCP session delete error' });
    }
  }
});

export default router;
