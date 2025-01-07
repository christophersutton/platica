import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { AuthController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupAuthRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = AuthController.create(db.db); // Pass the DatabaseProvider directly

  // Public auth routes
  const publicAuth = new Hono();
  publicAuth.post('/magic-link', controller.requestMagicLink);
  publicAuth.post('/verify', controller.verifyToken);

  // Mount public auth routes
  app.route('/auth', publicAuth);

  // Protected profile routes
  const profile = new Hono();
  profile.use('/*', auth.jwtAuth);
  profile.get('/', controller.getProfile);
  profile.patch('/', controller.updateProfile);

  // Mount profile routes
  app.route('/profile', profile);
} 