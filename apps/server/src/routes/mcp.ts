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
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMoltbloxMCPServer } from '@moltblox/mcp-server';
import { requireAuth } from '../middleware/auth.js';

const router: Router = Router();

interface McpSession {
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
 * POST /mcp
 *
 * If no mcp-session-id header: initialize a new MCP session.
 * If header present: route to existing session transport.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
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
    onsessioninitialized: (newId: string) => {
      sessions.set(newId, { transport, lastActivity: Date.now() });
    },
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

/**
 * GET /mcp
 *
 * SSE stream for server-to-client messages.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
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
});

/**
 * DELETE /mcp
 *
 * Terminate an MCP session.
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res
      .status(400)
      .json({ error: 'BadRequest', message: 'Missing or invalid mcp-session-id header' });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  sessions.delete(sessionId);
});

export default router;
