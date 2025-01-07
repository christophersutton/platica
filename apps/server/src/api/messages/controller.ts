import type { Context } from 'hono';
import { Database } from 'bun:sqlite';
import { BaseController, ApiError } from '../base-controller';
import { MessageRepository } from '../../db/repositories/message-repository';
import type { DatabaseProvider } from '../../db/repositories/base';

interface CreateMessageBody {
  content: string;
  thread_id?: number | null;
}

interface ReactionBody {
  emoji: string;
}

export class MessageController extends BaseController {
  private readonly messageRepo: MessageRepository;

  constructor(messageRepo: MessageRepository) {
    super();
    this.messageRepo = messageRepo;
  }

  static create(db: DatabaseProvider | Database): MessageController {
    const dbInstance = 'db' in db ? db.db : db;
    return new MessageController(new MessageRepository(dbInstance));
  }

  createMessage = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const body = await this.requireBody<CreateMessageBody>(c);

      // Check access
      if (!await this.messageRepo.hasChannelAccess(channelId, userId)) {
        throw new ApiError('Not a member of this channel', 403);
      }

      const messageId = await this.messageRepo.createMessage({
        workspace_id: workspaceId,
        channel_id: channelId,
        sender_id: userId,
        content: body.content,
        thread_id: body.thread_id ?? null,
        deleted_at: null,
        is_edited: false
      });

      // Return the created message with metadata
      const [message] = await this.messageRepo.getChannelMessages(channelId, undefined, 1);
      return message;
    });
  };

  getThreadMessages = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const threadId = this.requireNumberParam(c, 'threadId');
      const { userId } = this.requireUser(c);

      // Check access
      if (!await this.messageRepo.hasChannelAccess(channelId, userId)) {
        throw new ApiError('Not a member of this channel', 403);
      }

      return this.messageRepo.getThreadMessages(channelId, threadId);
    });
  };

  deleteMessage = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, 'messageId');
      const { userId } = this.requireUser(c);

      // TODO: Add permission check (only sender or admin can delete)
      await this.messageRepo.softDelete(messageId);
      return { success: true };
    });
  };

  addReaction = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, 'messageId');
      const { userId } = this.requireUser(c);
      const { emoji } = await this.requireBody<ReactionBody>(c);

      // TODO: Add reaction to message
      // await this.messageRepo.addReaction(messageId, userId, emoji);
      return { success: true };
    });
  };

  removeReaction = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, 'messageId');
      const { userId } = this.requireUser(c);
      const { emoji } = await this.requireBody<ReactionBody>(c);

      // TODO: Remove reaction from message
      // await this.messageRepo.removeReaction(messageId, userId, emoji);
      return { success: true };
    });
  };

  markAsRead = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const channelId = this.requireNumberParam(c, 'channelId');
      const { userId } = this.requireUser(c);

      // Check access
      if (!await this.messageRepo.hasChannelAccess(channelId, userId)) {
        throw new ApiError('Not a member of this channel', 403);
      }

      await this.messageRepo.markChannelAsRead(channelId, userId);
      return { success: true };
    });
  };
}