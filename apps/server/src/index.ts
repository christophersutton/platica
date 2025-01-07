import { DatabaseService } from './db/core/database';
import httpServer from './core/http-server';
import { startWebSocketServer } from './core/websocket-server';

// Initialize database
const db = DatabaseService.getWriteInstance();

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
  
  // Close database connection using the service
  db.close();
  
  console.log('👋 Shutdown complete');
  process.exit(0);
});