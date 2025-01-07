import { MessageRepository } from '../db/repositories/message-repository';
import { DatabaseService } from '../db/core/database';
import { WebSocketService } from './websockets';
import type { MessageCreateDTO } from '../db/repositories/message-repository';
import type { Message } from '@platica/shared/types';

interface MessageData {
  type: 'message';
  workspace_id: number;
  channel_id: number;
  sender_id: number;
  content: string;
  thread_id?: number;
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
    const messageData = {
      workspace_id: data.workspace_id,
      channel_id: data.channel_id,
      sender_id: data.sender_id,
      content: data.content,
      is_edited: false,
      thread_id: data.thread_id ?? null,
      deleted_at: null
    } as MessageCreateDTO;

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

    // Use the message's created_at timestamp
    const createdAt = messageWithMeta.created_at;
    console.log('[WriteService] Using timestamp:', {
      raw: createdAt,
      asDate: new Date(createdAt * 1000).toISOString()
    });

    const broadcastMessage = {
      type: 'chat',
      channelId: data.channel_id,
      content: data.content,
      userId: data.sender_id,
      messageId: createdMessage.id,
      createdAt,
      threadId: data.thread_id ?? null,
      sender_name: messageWithMeta.sender_name,
      avatar_url: messageWithMeta.avatar_url
    };

    console.log('[WriteService] Broadcasting message:', {
      ...broadcastMessage,
      propertyTypes: {
        type: typeof broadcastMessage.type,
        channelId: typeof broadcastMessage.channelId,
        content: typeof broadcastMessage.content,
        userId: typeof broadcastMessage.userId,
        messageId: typeof broadcastMessage.messageId,
        createdAt: typeof broadcastMessage.createdAt,
        threadId: typeof broadcastMessage.threadId,
        sender_name: typeof broadcastMessage.sender_name,
        avatar_url: typeof broadcastMessage.avatar_url
      }
    });

    // Broadcast to all clients in the workspace
    this.wsService.broadcastToWorkspace(data.workspace_id, broadcastMessage);
  }
}
