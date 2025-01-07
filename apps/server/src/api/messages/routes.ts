import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { MessageController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupMessageRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = MessageController.create(db);

  // Channel message routes
  const channelMessages = new Hono();
  channelMessages.use('/*', auth.jwtAuth);
  channelMessages.use('/*', auth.channelAuth);

  // Create message in channel
  channelMessages.post('/', controller.createMessage);

  // Get thread messages
  channelMessages.get('/threads/:threadId', controller.getThreadMessages);

  // Mark channel as read
  channelMessages.post('/read', controller.markAsRead);

  // Mount channel message routes
  app.route('/channels/:channelId/messages', channelMessages);

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
} 