import type { Context } from "hono";
import { Database } from "bun:sqlite";
import { BaseController, ApiError } from "../base-controller";
import {
  MessageRepository,
  type MessageCreateDTO,
} from "../../db/repositories/message-repository";
import type { DatabaseProvider } from "../../db/repositories/base";

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
    const dbInstance = "db" in db ? db.db : db;
    return new MessageController(new MessageRepository(dbInstance));
  }

  createMessage = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, "hubId");
      const workspaceId = this.requireNumberParam(c, "workspaceId");
      const { userId } = this.requireUser(c);
      const body = await this.requireBody<CreateMessageBody>(c);

      const messageId = await this.messageRepo.create({
        workspaceId: workspaceId,
        hubId: hubId,
        senderId: userId,
        content: body.content,
        threadId: body.thread_id ?? undefined,
        deletedAt: null,
        isEdited: false,
      } satisfies MessageCreateDTO);

      // Return the created message with metadata
      const [message] = await this.messageRepo.findByHub(
        hubId,
        undefined,
        1
      );
      return message;
    });
  };

  // getThreadMessages = async (c: Context): Promise<Response> => {
  //   return this.handle(c, async () => {
  //     const hubId = this.requireNumberParam(c, "hubId");
  //     const threadId = this.requireNumberParam(c, "threadId");
  //     const { userId } = this.requireUser(c);

     

  //     return this.messageRepo.getThreadMessages(hubId, threadId);
  //   });
  // };

  deleteMessage = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, "messageId");
      const { userId } = this.requireUser(c);

      // TODO: Add permission check (only sender or admin can delete)
      await this.messageRepo.delete(messageId);
      return { success: true };
    });
  };

  addReaction = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, "messageId");
      const { userId } = this.requireUser(c);
      const { emoji } = await this.requireBody<ReactionBody>(c);

      // TODO: Add reaction to message
      // await this.messageRepo.addReaction(messageId, userId, emoji);
      return { success: true };
    });
  };

  removeReaction = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, "messageId");
      const { userId } = this.requireUser(c);
      const { emoji } = await this.requireBody<ReactionBody>(c);

      // TODO: Remove reaction from message
      // await this.messageRepo.removeReaction(messageId, userId, emoji);
      return { success: true };
    });
  };

  markAsRead = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, "hubId");
      const { userId } = this.requireUser(c);

      
      // await this.messageRepo.markHubAsRead(hubId, userId);
      return { success: true };
    });
  };
}
