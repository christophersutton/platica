import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { WorkspaceController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupWorkspaceRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = WorkspaceController.create(db);

  // Workspace list routes
  const workspaces = new Hono();
  workspaces.use('/*', auth.jwtAuth);

  // List user's workspaces
  workspaces.get('/', controller.getWorkspaces);

  // Create new workspace
  workspaces.post('/', controller.createWorkspace);

  // Mount workspace list routes
  app.route('/workspaces', workspaces);

  // Workspace-specific routes
  const workspace = new Hono();
  workspace.use('/*', auth.jwtAuth);
  workspace.use('/*', auth.workspaceAuth);

  // Get workspace details
  workspace.get('/', controller.getWorkspace);

  // Update workspace settings
  workspace.patch('/', controller.updateWorkspace);

  // User management
  workspace.get('/users', controller.getUsers);
  workspace.post('/users/invite', controller.inviteUser);
  workspace.patch('/users/:userId', controller.updateUser);
  workspace.delete('/users/:userId', controller.removeUser);

  // Mount workspace-specific routes
  app.route('/workspaces/:workspaceId', workspace);
} 