import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ReadService } from './services/read';
import { AuthService } from './services/auth';
import { ManagementService } from './services/management';
import { DatabaseService } from './db/database';

const app = new Hono();
app.use('/*', cors());

// Initialize database services
const writeDb = DatabaseService.getWriteInstance();


// Mount services with appropriate database instances
const authService = new AuthService();
const readService = new ReadService();  // Uses its own read-only connection internally
const managementService = new ManagementService();

app.route('/api/auth', authService.router);
app.route('/api/read', readService.router);
app.route('/api/manage', managementService.router);

// Health check endpoint
app.get('/health', async (c) => {
  try {
    await writeDb.query('SELECT 1');
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

// Cleanup on exit
process.on('SIGTERM', () => {
  writeDb.close();
  process.exit(0);
});

export default {
  port: 3000,
  fetch: app.fetch
};