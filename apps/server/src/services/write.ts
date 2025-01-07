import { MessageRepository } from '../db/repositories/message-repository';
import { DatabaseService } from '../db/core/database';
import type { MessageCreateDTO } from '../db/repositories/message-repository';

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

  constructor() {
    this.db = DatabaseService.getWriteInstance();
    this.messageRepo = new MessageRepository(this.db.db);
  }
  async handleMessage(data: MessageData): Promise<void> {
    const messageData: MessageCreateDTO = {
      workspace_id: data.workspace_id,
      channel_id: data.channel_id,
      sender_id: data.sender_id,
      content: data.content,
      is_edited: false,
      thread_id: data.thread_id ?? null,
      deleted_at: null
    };

    await this.messageRepo.create(messageData);
  }
}
