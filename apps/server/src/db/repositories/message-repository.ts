import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Message } from '@models/message';
import { validateTimestamp } from '@types';
import type { MessageWithMeta } from '../../types/repository';
import { TimestampError } from '@platica/shared/src/utils/time';

// NEW: import the Zod schema for messages
import { MessageSchema } from '@models/schemas'; 
import { MessageType } from '@constants/enums';

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

    // Attempt Zod parse, ignoring the fact that in the DB 
    // we store numeric timestamps vs. the Zod schema is typically strings
    // We'll just do minimal bridging. 
    // For each timestamp, we might convert to number -> string or vice versa.

    // Example:
    // deserialized.createdAt = new Date(deserialized.createdAt * 1000).toISOString();
    // but for now, we proceed carefully to see if the domain wants numeric or string.

    // Convert to a shape that matches the schema
    const schemaCandidate = {
      id: String(deserialized.id),
      workspaceId: String(deserialized.workspaceId),
      hubId: deserialized.hubId ? String(deserialized.hubId) : undefined,
      roomId: undefined, // If implementing room messages, you'd add that 
      senderId: String((deserialized as any).senderId),
      threadId: deserialized.threadId ? String(deserialized.threadId) : undefined,
      content: deserialized.content,
      type: (deserialized).type || MessageType.TEXT,
      attachments: deserialized.attachments 
        ? JSON.parse(String(deserialized.attachments)) 
        : [],
      isEdited: !!deserialized.isEdited,
      editedAt: null,
      deletedAt: null, 
      createdAt: new Date((deserialized as any).createdAt * 1000).toISOString(),
      updatedAt: new Date((deserialized as any).updatedAt * 1000).toISOString(),
    };

    try {
      // parse with Zod
      const parsed = MessageSchema.parse(schemaCandidate);
      // Now map it back to domain if needed
      return {
        ...deserialized,
        // Overwrite the date fields with validated data
        id: parsed.id,
        workspaceId: Number(parsed.workspaceId),
        hubId: parsed.hubId ? Number(parsed.hubId) : undefined,
        content: parsed.content,
        type: parsed.type,
        attachments: parsed.attachments, // array 
        isEdited: parsed.isEdited,
        createdAt: (deserialized as any).createdAt,  // keep numeric if domain requires numeric
        updatedAt: (deserialized as any).updatedAt,
        deletedAt: null,
      } as Message;
    } catch (error) {
      console.error('Failed to Zod-parse message row:', error);
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
      hasThread: (row.has_thread as number) === 1,
    } as MessageWithMeta;
  }

  async findByHub(hubId: number, limit?: number, before?: number): Promise<MessageWithMeta[]> {
    // Example usage. We'll keep the basic structure, but parse results with Zod. 
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
        hasThread: (row.has_thread as number) === 1
      } as MessageWithMeta;
    });
  }
}