import { Database, type SQLQueryBindings } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Message, BaseModel } from '@models';
import type { UnixTimestamp } from '@types';
import { validateTimestamp } from '@types';
import type { MessageWithMeta } from '../../types/repository';
import { TimestampError } from '@platica/shared/src/utils/time';

export type MessageCreateDTO = Omit<Message, keyof BaseModel | 'attachments' | 'sender'> & {
  attachments?: string; // JSON string
  senderId: number;
};

export type MessageUpdateDTO = Partial<MessageCreateDTO>;

export class MessageRepository extends BaseRepository<Message, MessageCreateDTO, MessageUpdateDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return 'messages';
  }

  protected getJsonFields(): string[] {
    return ['attachments'];
  }

  protected getBooleanFields(): string[] {
    return ['isEdited'];
  }

  protected deserializeRow<D extends object>(data: D): Message {
    const deserialized = super.deserializeRow(data);
    
    // Validate timestamps - they should already be in seconds from the database
    try {
      if (deserialized.createdAt) {
        deserialized.createdAt = validateTimestamp(Number(deserialized.createdAt));
      }
      
      if (deserialized.updatedAt) {
        deserialized.updatedAt = validateTimestamp(Number(deserialized.updatedAt));
      }
      
      if (deserialized.deletedAt) {
        deserialized.deletedAt = validateTimestamp(Number(deserialized.deletedAt));
      }
    } catch (error) {
      console.error('Timestamp validation failed:', error);
      throw new TimestampError(
        `Invalid timestamp in message ${deserialized.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    return deserialized;
  }

  async findWithMeta(messageId: number): Promise<MessageWithMeta | undefined> {
    const query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url,
        COUNT(r.message_id) as reaction_count,
        CASE WHEN EXISTS(SELECT 1 FROM messages t WHERE t.thread_id = m.id) THEN 1 ELSE 0 END as has_thread
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN reactions r ON r.message_id = m.id
      WHERE m.id = ?
      GROUP BY m.id
    `;

    const row = this.db.query(query).get(messageId) as MessageWithMeta | undefined;
    if (!row) return undefined;

    const deserialized = this.deserializeRow(row);
    return {
      ...deserialized,
      sender_name: row.sender_name,
      avatar_url: row.avatar_url,
      reaction_count: Number(row.reaction_count),
      has_thread: row.has_thread as 0 | 1
    } as MessageWithMeta;
  }

  async findByChannel(channelId: number, limit?: number, before?: number): Promise<MessageWithMeta[]> {
    let query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url,
        COUNT(r.message_id) as reaction_count,
        CASE WHEN EXISTS(SELECT 1 FROM messages t WHERE t.thread_id = m.id) THEN 1 ELSE 0 END as has_thread
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN reactions r ON r.message_id = m.id
      WHERE m.channel_id = ?
    `;

    const params: (string | number)[] = [channelId];

    if (before) {
      query += ` AND m.id < ?`;
      params.push(before);
    }

    query += ` GROUP BY m.id ORDER BY m.created_at DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = this.db.query(query).all(...params) as MessageWithMeta[];
    return rows.map(row => ({
      ...this.deserializeRow(row),
      sender_name: row.sender_name,
      avatar_url: row.avatar_url,
      reaction_count: Number(row.reaction_count),
      has_thread: row.has_thread as 0 | 1
    })) as MessageWithMeta[];
  }
} 