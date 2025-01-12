import type { Context } from "hono";
import { Database } from "bun:sqlite";
import { BaseController, ApiError } from "../base-controller";
import { MessageRepository, type MessageCreateDTO } from "../../db/repositories/message-repository";
import type { DatabaseProvider } from "../../db/repositories/base";

// NEW: We'll also import the zod schema for messages to validate request bodies
import { MessageSchema } from "@models/schemas";
import { z } from "zod";

interface CreateMessageBody {
  content: string;
  thread_id?: number | null;
}

const createMessageBodySchema = z.object({
  content: z.string().min(1, "Message content required"),
  thread_id: z.number().optional().nullable()
});

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
      // Or if the workspaceId is in the route or headers:
      const workspaceId = Number(c.req.header('x-workspace-id') || 0); 
      // or however you handle passing workspaceId

      const { userId } = this.requireUser(c);
      // Validate request body with zod
      const jsonBody = await c.req.json();
      const parsedBody = createMessageBodySchema.parse(jsonBody);

      const dto: MessageCreateDTO = {
        workspaceId,
        hubId,
        senderId: userId,
        content: parsedBody.content,
        threadId: parsedBody.thread_id ?? undefined,
        deletedAt: null,
        isEdited: false,
      };
      const messageRecord = await this.messageRepo.create(dto);

      // Return the newly created message
      const found = await this.messageRepo.findWithMeta(messageRecord.id);
      return found;
    });
  };

  deleteMessage = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const messageId = this.requireNumberParam(c, "messageId");
      const { userId } = this.requireUser(c);
      // Possibly check ownership or admin role
      await this.messageRepo.delete(messageId);
      return { success: true };
    });
  };

  addReaction = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      // Not fully implemented yet
      const messageId = this.requireNumberParam(c, "messageId");
      const { userId } = this.requireUser(c);
      const body = await this.requireBody<ReactionBody>(c);
      // ...
      return { success: true };
    });
  };

  removeReaction = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      // Not fully implemented
      const messageId = this.requireNumberParam(c, "messageId");
      const { userId } = this.requireUser(c);
      // ...
      return { success: true };
    });
  };

  markAsRead = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const hubId = this.requireNumberParam(c, "hubId");
      const { userId } = this.requireUser(c);
      // If there's a method for marking read:
      // await this.messageRepo.markAsRead(hubId, userId);
      return { success: true };
    });
  };
}