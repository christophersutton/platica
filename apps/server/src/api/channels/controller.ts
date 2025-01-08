import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { ChannelRepository } from '../../db/repositories/channel-repository';
import { MessageRepository } from '../../db/repositories/message-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import type { Channel, ChannelCreateDTO } from '@platica/shared/types';
import type { Variables } from '../../middleware/auth';
import { WebSocketService } from '../../services/websockets';

interface CreateChannelBody {
  name: string;
  description?: string;
  is_private?: boolean;
}

interface AddMemberBody {
  user_id: number;
}

export class ChannelController extends BaseController {
  constructor(
    private readonly channelRepo: ChannelRepository,
    private readonly messageRepo: MessageRepository,
    private readonly wsService: WebSocketService
  ) {
    super();
  }

  static create(dbProvider: DatabaseProvider): ChannelController {
    return new ChannelController(
      new ChannelRepository(dbProvider.db),
      new MessageRepository(dbProvider.db),
      WebSocketService.getInstance()
    );
  }

  getWorkspaceChannels = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const userRole = c.get('userRole') || 'member';

      const channels = await this.channelRepo.findByWorkspace(workspaceId, userId);
      return { channels };
    });
  };

  private async ensureChannelAccess(channelId: number, userId: number): Promise<string> {
    // First get the channel to check if it's public
    const channel = await this.channelRepo.findById(channelId);
    if (!channel) {
      throw new ApiError('Channel not found', 404);
    }

    // Then check if user is already a member
    const memberRole = await this.channelRepo.getMemberRole(channelId, userId);
    if (memberRole) {
      return memberRole;
    }

    // If not a member but channel is public, auto-join
    if (!channel.is_private) {
      // Auto-join public channel
      await this.channelRepo.addMember(channelId, userId, 'member');
      
      // Broadcast member joined event
      this.wsService.broadcastToWorkspace(channel.workspace_id, {
        type: 'member_joined',
        channelId,
        userId,
        role: 'member'
      });
      
      return 'member';
    }

    throw new ApiError('Not a member of this channel', 403);
  }

  getChannelMessages = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      try {
        const channelId = this.requireNumberParam(c, 'channelId');
        const { userId } = this.requireUser(c);
        const before = c.req.query('before');
        const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

        // Check if user can access the channel
        const canAccess = await this.channelRepo.canAccess(channelId, userId);
        if (!canAccess) {
          throw new ApiError('Not authorized to access this channel', 403);
        }

        // Check if user is already a member
        let isMember = await this.channelRepo.getMemberRole(channelId, userId);
        
        // If not a member but channel is public, auto-join
        if (!isMember) {
          const channel = await this.channelRepo.findById(channelId);
          if (channel && !channel.is_private) {
            await this.channelRepo.addMember(channelId, userId, 'member');
            isMember = 'member';
            
            // Broadcast member joined event
            this.wsService.broadcastToWorkspace(channel.workspace_id, {
              type: 'member_joined',
              channelId,
              userId,
              role: 'member'
            });
          }
        }

        // Get messages
        const messages = await this.messageRepo.findByChannel(
          channelId,
          limit,
          before ? Number(before) : undefined
        );

        // Only update last read timestamp if user is a member
        if (isMember) {
          await this.channelRepo.updateMember(channelId, userId, {
            last_read_at: Math.floor(Date.now() / 1000)
          });
        }
        
        return { messages };
      } catch (error) {
        console.error('Error in getChannelMessages:', error);
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError('Failed to fetch channel messages', 500);
      }
    });
  };

  createChannel = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const body = await c.req.json<CreateChannelBody>();

      const channel = await this.channelRepo.create({
        workspace_id: workspaceId,
        name: body.name,
        description: body.description || undefined,
        is_private: body.is_private || false,
        is_archived: false,
        created_by: userId,
        settings: {}
      } as ChannelCreateDTO);

      // Add creator as admin
      await this.channelRepo.addMember(channel.id, userId, 'admin');

      // Broadcast new channel to all workspace members
      this.wsService.broadcastToWorkspace(workspaceId, {
        type: 'channel_created',
        channel
      });

      return { channel };
    });
  };

  addMember = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const { userId: currentUserId } = this.requireUser(c);
      const body = await this.requireBody<AddMemberBody>(c);

      // Check if current user has access
      const memberRole = await this.channelRepo.getMemberRole(channelId, currentUserId);
      if (!memberRole) {
        throw new ApiError('Not a member of this channel', 403);
      }

      await this.channelRepo.addMember(channelId, body.user_id);
      return { success: true };
    });
  };

  removeMember = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const userId = this.requireNumberParam(c, 'userId');
      const { userId: currentUserId } = this.requireUser(c);

      // Check if current user has access
      const memberRole = await this.channelRepo.getMemberRole(channelId, currentUserId);
      if (!memberRole) {
        throw new ApiError('Not a member of this channel', 403);
      }

      await this.channelRepo.removeMember(channelId, userId);
      return { success: true };
    });
  };

  getMembers = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const { userId } = this.requireUser(c);

      // Check access
      const memberRole = await this.channelRepo.getMemberRole(channelId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this channel', 403);
      }

      return this.channelRepo.findMembers(channelId);
    });
  };

  async getMessages(c: Context<{ Variables: Variables }>) {
    const channelId = Number(c.req.param('channelId'));
    const userId = c.get('user').userId;

    try {
      const messages = await this.messageRepo.getChannelMessages(channelId);
      // Mark channel as read when getting messages
      await this.messageRepo.markChannelAsRead(channelId, userId);
      return c.json({ messages });
    } catch (error) {
      console.error('Error getting channel messages:', error);
      return c.json({ error: 'Failed to get channel messages' }, 500);
    }
  }

  markAsRead = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const { userId } = this.requireUser(c);

      // Update the last_read_at timestamp
      await this.channelRepo.updateMember(channelId, userId, {
        last_read_at: Math.floor(Date.now() / 1000)
      });

      return { success: true };
    });
  };
} 