import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DatabaseService } from '../db/core/database.ts';
import { AuthMiddleware } from '../middleware/auth.ts';
import { setupAuthRoutes } from '../api/auth/routes.ts';
import { setupChannelRoutes } from '../api/channels/routes.ts';
import { setupMessageRoutes } from '../api/messages/routes.ts';
import { setupWorkspaceRoutes } from '../api/workspaces/routes.ts';

const app = new Hono();

// Global middleware
app.use('/*', cors());

// Initialize database service
const db = DatabaseService.getWriteInstance();

// Initialize auth middleware
const auth = new AuthMiddleware(db);

// Create API router
const api = new Hono();

// Mount API routes
setupAuthRoutes(api, db, auth);
setupWorkspaceRoutes(api, db, auth);
setupChannelRoutes(api, db, auth);
setupMessageRoutes(api, db, auth);

// Health check endpoint
api.get('/health', async (c) => {
  try {
    await db.query('SELECT 1');
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    } as const);
  } catch (error) {
    c.status(503);
    return c.json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    } as const);
  }
});

// Mount all routes under /api
app.route('/api', api);

// Cleanup on exit
process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

// Export server configuration for Bun.serve
export default {
  port: 3000,
  fetch: app.fetch
};