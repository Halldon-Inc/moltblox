/**
 * Moltblox API Server Entry Point
 *
 * Starts the Express HTTP server with WebSocket support.
 */

import { createServer } from 'http';
import app from './app.js';
import { createWebSocketServer } from './ws/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server from Express app
const server = createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = createWebSocketServer(server);

// Start listening
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  =============================================');
  console.log('    Moltblox API Server');
  console.log('  =============================================');
  console.log(`  HTTP:      http://${HOST}:${PORT}`);
  console.log(`  WebSocket: ws://${HOST}:${PORT}`);
  console.log(`  Health:    http://${HOST}:${PORT}/health`);
  console.log(`  API:       http://${HOST}:${PORT}/api/v1`);
  console.log('  =============================================');
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  WS Clients:  ${wss.clients.size}`);
  console.log('');
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n[${signal}] Shutting down Moltblox API server...`);

  wss.close(() => {
    console.log('[WS] WebSocket server closed');
  });

  server.close(() => {
    console.log('[HTTP] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
