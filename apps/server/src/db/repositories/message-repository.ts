import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Message, BaseModel, UnixTimestamp } from '@platica/shared/types';

export type MessageCreateDTO = Omit<Message, keyof BaseModel | 'attachments'> & {
  attachments?: string; // JSON string
  deleted_at: UnixTimestamp | null;
  is_edited: boolean;
};

export type MessageUpdateDTO = Partial<MessageCreateDTO>;

interface MessageWithMeta extends Message {
  sender_name: string;
  avatar_url: string | null;
  reaction_count: number;
  reply_count?: number;
  has_thread: 0 | 1;
  attachments?: string; // JSON string of attachments
}

export class MessageRepository extends BaseRepository<Message, MessageCreateDTO, MessageUpdateDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return 'messages';
  }

  async findByChannel(channelId: number, limit = 50, before?: number): Promise<MessageWithMeta[]> {
    const query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url,
        (SELECT COUNT(*) FROM reactions r WHERE r.message_id = m.id) as reaction_count,
        (SELECT COUNT(*) FROM messages r WHERE r.thread_id = m.id) as reply_count,
        (EXISTS (SELECT 1 FROM messages r WHERE r.thread_id = m.id)) as has_thread
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.channel_id = ?
        ${before ? 'AND m.id < ?' : ''}
      ORDER BY m.created_at DESC
      LIMIT ?
    `;

    const params = before 
      ? [channelId, before, limit]
      : [channelId, limit];

    return this.db.prepare(query).all(...params) as MessageWithMeta[];
  }

  async findByThread(threadId: number, limit = 50, before?: number): Promise<MessageWithMeta[]> {
    const query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url,
        (SELECT COUNT(*) FROM reactions r WHERE r.message_id = m.id) as reaction_count
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.thread_id = ?
        ${before ? 'AND m.id < ?' : ''}
      ORDER BY m.created_at DESC
      LIMIT ?
    `;

    const params = before 
      ? [threadId, before, limit]
      : [threadId, limit];

    return this.db.prepare(query).all(...params) as MessageWithMeta[];
  }

  async findWithMeta(messageId: number): Promise<MessageWithMeta | undefined> {
    const query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url,
        (SELECT COUNT(*) FROM reactions r WHERE r.message_id = m.id) as reaction_count,
        (SELECT COUNT(*) FROM messages r WHERE r.thread_id = m.id) as reply_count,
        (EXISTS (SELECT 1 FROM messages r WHERE r.thread_id = m.id)) as has_thread
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `;

    return this.db.prepare(query).get(messageId) as MessageWithMeta | undefined;
  }

  override async create(data: MessageCreateDTO): Promise<Message> {
    // Convert attachments to JSON string if present
    const dbData = {
      ...data,
      attachments: data.attachments ? data.attachments : '[]'
    };

    return super.create(dbData);
  }

  override async update(id: number, data: MessageUpdateDTO): Promise<Message | undefined> {
    // Convert attachments to JSON string if present
    const dbData = {
      ...data,
      attachments: data.attachments ? data.attachments : undefined
    };

    return super.update(id, dbData);
  }

  async hasChannelAccess(channelId: number, userId: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM channel_members 
      WHERE channel_id = ? AND user_id = ?
      LIMIT 1
    `;
    const result = this.db.prepare(query).get(channelId, userId);
    return !!result;
  }

  async createMessage(data: MessageCreateDTO): Promise<number> {
    const message = await this.create(data);
    return message.id;
  }

  async getChannelMessages(channelId: number, before?: number, limit = 50): Promise<MessageWithMeta[]> {
    return this.findByChannel(channelId, limit, before);
  }

  async getThreadMessages(channelId: number, threadId: number): Promise<MessageWithMeta[]> {
    // First verify the thread belongs to the channel
    const threadMessage = await this.findById(threadId);
    if (!threadMessage || threadMessage.channel_id !== channelId) {
      throw new Error('Thread not found in channel');
    }
    return this.findByThread(threadId);
  }

  async softDelete(messageId: number): Promise<void> {
    await this.update(messageId, { deleted_at: Math.floor(Date.now() / 1000) });
  }

  async markChannelAsRead(channelId: number, userId: number): Promise<void> {
    const query = `
      INSERT INTO channel_read_status (channel_id, user_id, last_read_at)
      VALUES (?, ?, ?)
      ON CONFLICT (channel_id, user_id) DO UPDATE 
      SET last_read_at = excluded.last_read_at
    `;
    await this.db.prepare(query).run(channelId, userId, Math.floor(Date.now() / 1000));
  }
} 