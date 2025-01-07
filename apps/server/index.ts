import { Database } from 'bun:sqlite';
import httpServer from './http-server';
import { startWebSocketServer } from './websocket-server';

// Initialize database
const db = new Database('main.sqlite', { create: true });
db.run('PRAGMA journal_mode = WAL');

// HTTP Server
const HTTP_PORT = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3000;
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3001;

console.log(`🚀 Starting servers...`);

// Start HTTP server
Bun.serve({
  ...httpServer,
  port: HTTP_PORT,
});

// Start WebSocket server
startWebSocketServer(WS_PORT);

console.log(`✅ HTTP server running at http://localhost:${HTTP_PORT}`);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down servers...');
  
  // Close database connection
  db.close();
  
  console.log('👋 Shutdown complete');
  process.exit(0);
});