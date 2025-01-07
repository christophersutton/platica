import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { ChannelRepository } from '../../db/repositories/channel-repository';
import { MessageRepository } from '../../db/repositories/message-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import type { Channel } from '@platica/shared';

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
    private readonly messageRepo: MessageRepository
  ) {
    super();
  }

  static create(dbProvider: DatabaseProvider): ChannelController {
    return new ChannelController(
      new ChannelRepository(dbProvider.db),
      new MessageRepository(dbProvider.db)
    );
  }

  getWorkspaceChannels = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const userRole = c.get('userRole') || 'member';

      return this.channelRepo.findByWorkspace(workspaceId, userId);
    });
  };

  getChannelMessages = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const { userId } = this.requireUser(c);
      const before = c.req.query('before');
      const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

      // Check access
      const memberRole = await this.channelRepo.getMemberRole(channelId, userId);
      if (!memberRole) {
        throw new ApiError('Not a member of this channel', 403);
      }

      const messages = await this.messageRepo.findByChannel(
        channelId,
        limit,
        before ? Number(before) : undefined
      );

      // Update last read message timestamp for this channel
      await this.channelRepo.updateMember(channelId, userId, {
        last_read_at: Math.floor(Date.now() / 1000)
      });
      
      return messages;
    });
  };

  createChannel = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const body = await this.requireBody<CreateChannelBody>(c);

      // Create channel
      const channel = await this.channelRepo.create({
        workspace_id: workspaceId,
        name: body.name,
        topic: body.description || null,
        is_private: body.is_private || false,
        settings: {}
      });

      // Add creator as member with owner role
      await this.channelRepo.addMember(channel.id, userId, 'owner');

      return channel;
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
} 