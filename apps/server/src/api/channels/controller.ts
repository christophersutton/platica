import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { ChannelRepository } from '../../db/repositories/channel-repository';
import { MessageRepository } from '../../db/repositories/message-repository';
import { WorkspaceRepository } from '../../db/repositories/workspace-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import type { Channel, CreateChannelDTO } from '@models/channel';
import type { Variables } from '../../middleware/auth';
import { WebSocketService } from '../../services/websockets';
import { WSEventType } from '@websockets';
import type { PresenceEvent, ChannelCreatedEvent } from '@websockets';

interface CreateChannelBody {
  name: string;
  description?: string;
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
      try {
        const workspaceId = this.requireNumberParam(c, 'workspaceId');
        console.log('Workspace ID:', workspaceId);

        const { userId } = this.requireUser(c);
        console.log('User ID:', userId);

        const userRole = c.get('userRole') || 'member';
        console.log('User Role:', userRole);

        // Check workspace membership using workspace repository
        const workspaceRepo = new WorkspaceRepository(this.channelRepo['db']);
        const memberRole = await workspaceRepo.getMemberRole(workspaceId, userId);
        console.log('Workspace Member Role:', memberRole);

        if (!memberRole) {
          throw new ApiError('Not a member of this workspace', 403);
        }

        const channels = await this.channelRepo.findByWorkspace(workspaceId, userId);
        console.log('Found Channels:', channels?.length || 0);
        return { channels };
      } catch (error) {
        console.error('Error in getWorkspaceChannels:', error);
        throw error;
      }
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

    throw new ApiError('Not a member of this channel', 403);
  }

  getChannelMessages = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      try {
        const channelId = this.requireNumberParam(c, 'channelId');
        const { userId } = this.requireUser(c);
        const before = c.req.query('before');
        const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

        // Check if user is a member
        const memberRole = await this.channelRepo.getMemberRole(channelId, userId);
        if (!memberRole) {
          throw new ApiError('Not a member of this channel', 403);
        }

        // Get messages
        const messages = await this.messageRepo.findByChannel(
          channelId,
          // limit,
          // before ? Number(before) : undefined
        );

        // Update last read timestamp
        await this.channelRepo.updateMember(channelId, userId, {
          lastReadAt: Math.floor(Date.now() / 1000)
        });
        
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
        workspaceId,
        name: body.name,
        description: body.description || undefined,
        isArchived: false,
        createdBy: userId,
        settings: {}
      } as CreateChannelDTO);

      // Add creator as admin
      await this.channelRepo.addMember(channel.id, userId, 'admin');

      // Broadcast new channel to all workspace members
      this.wsService.broadcastToWorkspace(channel.workspaceId, {
        type: WSEventType.CHANNEL_CREATED,
        payload: {
          channel
        }
      } as ChannelCreatedEvent);

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
    const before = c.req.query('before');
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

    try {
      const messages = await this.messageRepo.findByChannel(channelId/*, limit, before ? Number(before) : undefined*/);
      // Mark channel as read
      await this.channelRepo.updateMember(channelId, userId, {
        lastReadAt: Math.floor(Date.now() / 1000)
      });
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

      // Update the lastReadAt timestamp
      await this.channelRepo.updateMember(channelId, userId, {
        lastReadAt: Math.floor(Date.now() / 1000)
      });

      return { success: true };
    });
  };
} 