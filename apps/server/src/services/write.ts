import { Database } from "bun:sqlite";
import { WebSocketService } from './websockets';
import { DatabaseService } from '../db/core/database';
import { MessageRepository } from '../db/repositories/message-repository';
import { WSEventType } from '@websockets';
import type { Message } from '@models';
import type { MessageCreateDTO } from '../db/repositories/message-repository';

interface MessageData {
  type: 'message';
  workspaceId: number;
  channelId: number;
  senderId: number;
  content: string;
  threadId?: number;
}

export default class WriteService {
  private messageRepo: MessageRepository;
  private db: DatabaseService;
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.db = DatabaseService.getWriteInstance();
    this.messageRepo = new MessageRepository(this.db.db);
    this.wsService = wsService;
  }

  async handleMessage(data: MessageData): Promise<void> {
    const messageData: MessageCreateDTO = {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      content: data.content,
      threadId: data.threadId,
      senderId: data.senderId,
      isEdited: false,
      deletedAt: null,
      attachments: '[]'
    };

    // First create the message
    const createdMessage = await this.messageRepo.create(messageData);
    console.log('[WriteService] Created message:', createdMessage);

    // Then get the message with metadata
    const messageWithMeta = await this.messageRepo.findWithMeta(createdMessage.id);
    if (!messageWithMeta) {
      console.error('[WriteService] Failed to get message metadata');
      return;
    }
    console.log('[WriteService] Got message metadata:', messageWithMeta);

    // Log the timestamp in a safe way
    console.log('[WriteService] Using timestamp:', {
      unix: messageWithMeta.createdAt,
      ms: messageWithMeta.createdAt * 1000
    });

    // Broadcast to all clients in the workspace
    this.wsService.broadcastToWorkspace(data.workspaceId, {
      type: WSEventType.CHAT,
      payload: {
        message: messageWithMeta
      }
    });
  }
}
