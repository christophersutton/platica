/*
  File: index.ts

  Minor adjustments to ensure correctness, 
  no major issues found except verifying environment variables 
  or code references. 
  We'll keep this mostly the same.
*/

import { DatabaseService } from './db/core/database';
import httpServer from './core/http-server';
import { startWebSocketServer } from './core/websocket-server';

const db = DatabaseService.getWriteInstance();

const HTTP_PORT = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3000;
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3001;

console.log(`🚀 Starting servers...`);

Bun.serve({
  ...httpServer,
  port: HTTP_PORT,
});

startWebSocketServer(WS_PORT);

console.log(`✅ HTTP server running at http://localhost:${HTTP_PORT}`);

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down servers...');
  db.close();
  console.log('👋 Shutdown complete');
  process.exit(0);
});