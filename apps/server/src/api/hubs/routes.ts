import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { HubController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupHubRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = HubController.create(db);

  // Hub routes
  const hubs = new Hono();
  hubs.use('/*', auth.jwtAuth);
  hubs.use('/:hubId/*', auth.hubAuth);

  // Get hub
 
  hubs.get('/:hubId/messages', controller.getHubMessages);
  
  // Get hub
 
  hubs.get('/:hubId/members', controller.getMembers);
  
  // Add member to hub

  hubs.post('/:hubId/members', controller.addMember);
  
  // Remove member from hub

  hubs.delete('/:hubId/members/:userId', controller.removeMember);

  // Mark hub
 
  hubs.post('/:hubId/read', controller.markAsRead);

  // Mount hub
 
  app.route('/hubs', hubs);

  // Workspace-specific hub
 
  const workspaceHubs = new Hono();
  workspaceHubs.use('/*', auth.jwtAuth);
  workspaceHubs.use('/*', auth.workspaceAuth);

  // List workspace hubs
  workspaceHubs.get('/', controller.getWorkspaceHubs);
  
  // Get single hub
  workspaceHubs.get('/:hubId', controller.getHub);
  
  // Get hub messages
  workspaceHubs.get('/:hubId/messages', controller.getHubMessages);
  
  // Create hub in workspace
  workspaceHubs.post('/', controller.createHub);

  // Mount workspace hub routes
  app.route('/workspaces/:workspaceId/hubs', workspaceHubs);
} 