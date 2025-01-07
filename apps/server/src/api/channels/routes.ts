import { Hono } from 'hono';
import type { DatabaseProvider } from '../../db/repositories/base';
import { ChannelController } from './controller';
import type { AuthMiddleware } from '../../middleware/auth';

export function setupChannelRoutes(app: Hono, db: DatabaseProvider, auth: AuthMiddleware): void {
  const controller = ChannelController.create(db);

  // Channel routes
  const channels = new Hono();
  channels.use('/*', auth.jwtAuth);
  channels.use('/:channelId/*', auth.channelAuth);

  // Get channel messages
  channels.get('/:channelId/messages', controller.getChannelMessages);
  
  // Get channel members
  channels.get('/:channelId/members', controller.getMembers);
  
  // Add member to channel
  channels.post('/:channelId/members', controller.addMember);
  
  // Remove member from channel
  channels.delete('/:channelId/members/:userId', controller.removeMember);

  // Mount channel routes
  app.route('/channels', channels);

  // Workspace-specific channel routes
  const workspaceChannels = new Hono();
  workspaceChannels.use('/*', auth.jwtAuth);
  workspaceChannels.use('/*', auth.workspaceAuth);

  // List workspace channels
  workspaceChannels.get('/', controller.getWorkspaceChannels);
  
  // Create channel in workspace
  workspaceChannels.post('/', controller.createChannel);

  // Mount workspace channel routes
  app.route('/workspaces/:workspaceId/channels', workspaceChannels);
} 