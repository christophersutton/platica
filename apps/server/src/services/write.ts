import { DatabaseService } from '../db/core/database';
import { MessageRepository } from '../db/repositories/message-repository';
import { WSEventType } from '@websockets';
import type { MessageCreateDTO } from '../db/repositories/message-repository';
import { WebSocketService } from './websockets';

/**
 * WriteService:
 * Minimal wrapper that delegates message creation to the MessageRepository
 * and then broadcasts the created message to connected clients.
 */
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
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    const db = DatabaseService.getWriteInstance().db;
    this.messageRepo = new MessageRepository(db);
    this.wsService = wsService;
  }

  /**
   * handleMessage:
   * Creates a message in the DB, fetches metadata, and broadcasts it.
   */
  async handleMessage(data: MessageData): Promise<void> {
    // Delegate creation to the repository
    const messageData: MessageCreateDTO = {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      senderId: data.senderId,
      content: data.content,
      threadId: data.threadId,
      isEdited: false,
      deletedAt: null,
      attachments: '[]'
    };

    // Create message
    const createdMessage = await this.messageRepo.create(messageData);

    // Fetch metadata
    const messageWithMeta = await this.messageRepo.findWithMeta(createdMessage.id);
    if (!messageWithMeta) {
      console.error('[WriteService] Failed to get message metadata');
      return;
    }

    // Broadcast to all clients in the workspace
    this.wsService.broadcastToWorkspace(data.workspaceId, {
      type: WSEventType.CHAT,
      payload: {
        message: messageWithMeta
      }
    });
  }
}