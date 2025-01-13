import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { MessageController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupMessageRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = MessageController.create(db);

  // Hub message routes
  const hubMessages = new Hono();
  hubMessages.use('/*', auth.jwtAuth);
  hubMessages.use('/*', auth.hubAuth);

  // Create message in hub

  hubMessages.post('/', controller.createMessage);

  // // Get thread messages
  // hubMessages.get('/threads/:threadId', controller.getThreadMessages);

  // Mark hub as read
  hubMessages.post('/read', controller.markAsRead);

  // Mount hub message routes
  app.route('/hubs/:hubId/messages', hubMessages);

  // Message-specific routes
  const messages = new Hono();
  messages.use('/*', auth.jwtAuth);

  // Delete message
  messages.delete('/:messageId', controller.deleteMessage);

  // Reactions
  messages.post('/:messageId/reactions', controller.addReaction);
  messages.delete('/:messageId/reactions', controller.removeReaction);

  // Mount message routes
  app.route('/messages', messages);

  // Add workspace-specific hub message routes
  const workspaceHubMessages = new Hono();
  workspaceHubMessages.use('/*', auth.jwtAuth);
  workspaceHubMessages.use('/*', auth.workspaceAuth);

  // Create message in workspace hub
  workspaceHubMessages.post('/', controller.createMessage);

  // Mount workspace hub message routes
  app.route('/workspaces/:workspaceId/hubs/:hubId/messages', workspaceHubMessages);
} 