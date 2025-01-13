import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Message } from '@models/message';
import { validateTimestamp } from '@types';
import type { MessageWithMeta } from '../../types/repository';
import { TimestampError } from '@platica/shared/src/utils/time';
import { MessageSchema } from '@models/schemas'; 
import { MessageType } from '@constants/enums';
import type { ValidatedUnixTimestamp } from '@types';

export type MessageCreateDTO = {
  workspaceId: number;
  hubId?: number;
  roomId?: number; 
  senderId: number;
  threadId?: number;
  content: string;
  type?: string;
  isEdited?: boolean;
  deletedAt?: number | null;
  // We store attachments as JSON in DB
  attachments?: string;
};

export type MessageUpdateDTO = Partial<MessageCreateDTO>;

/**
 * Extended repository for messages, 
 * now parses DB results with Zod to ensure correctness
 */
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

  /**
   * Override to parse row using Zod schema 
   * (and re-map DB fields to domain fields if needed).
   */
  protected deserializeRow<D extends object>(data: D): Message {
    const deserialized = super.deserializeRow(data);

    // Ensure we have valid timestamps before proceeding
    const createdAt = validateTimestamp((deserialized as any).createdAt);
    const updatedAt = validateTimestamp((deserialized as any).updatedAt);
    
    if (!createdAt || !updatedAt) {
      throw new TimestampError('Invalid timestamp in message row');
    }

    // Convert to a shape that matches the schema for validation
    const schemaCandidate = {
      id: String(deserialized.id),
      workspaceId: String(deserialized.workspaceId),
      hubId: String(deserialized.hubId || ''), // Convert to empty string if null/undefined
      roomId: null,
      senderId: String((deserialized as any).senderId),
      threadId: deserialized.threadId ? String(deserialized.threadId) : null,
      content: deserialized.content,
      type: (deserialized as any).type || 'text',
      isEdited: !!deserialized.isEdited,
      editedAt: null,
      deletedAt: null, 
      createdAt: new Date(createdAt * 1000).toISOString(),
      updatedAt: new Date(updatedAt * 1000).toISOString(),
    };

    try {
      // Validate with Zod schema
      const parsed = MessageSchema.parse(schemaCandidate);

      return {
        id: Number(parsed.id),
        workspaceId: Number(parsed.workspaceId),
        hubId: Number(parsed.hubId), // hubId is required
        content: parsed.content,
        threadId: parsed.threadId ? Number(parsed.threadId) : undefined,
        isEdited: parsed.isEdited,
        createdAt,
        updatedAt,
        deletedAt: null,
        sender: {} as any // Will be populated by join queries
      };
    } catch (error) {
      console.error('Failed to validate message:', error);
      throw error;
    }
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

    const row = this.db.query(query).get(messageId) as Record<string, unknown> | undefined;
    if (!row) return undefined;

    const deserialized = this.deserializeRow(row);
    return {
      ...deserialized,
      sender: {
        id: row.sender_id as number,
        name: row.sender_name as string,
        avatarUrl: row.avatar_url as string | null
      },
      reactionCount: Number(row.reaction_count),
      hasThread: Number(row.has_thread) as 0 | 1
    } as MessageWithMeta;
  }

  async findByHub(hubId: number, limit?: number, before?: number): Promise<MessageWithMeta[]> {
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
      WHERE m.hub_id = ?
    `;
    const params: (string | number)[] = [hubId];

    if (before) {
      query += ` AND m.id < ?`;
      params.push(before);
    }

    query += ` GROUP BY m.id ORDER BY m.created_at DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    const rows = this.db.query(query).all(...params) as Record<string, unknown>[];
    return rows.map((row) => {
      const base = this.deserializeRow(row);
      return {
        ...base,
        sender: {
          id: row.sender_id as number,
          name: row.sender_name as string,
          avatarUrl: row.avatar_url as string | null
        },
        reactionCount: Number(row.reaction_count),
        hasThread: Number(row.has_thread) as 0 | 1
      } as MessageWithMeta;
    });
  }
}