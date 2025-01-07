import { Database } from 'bun:sqlite';
import { DatabaseService } from './database';

export interface Message {
  id: number;
  workspace_id: number;
  channel_id: number;
  sender_id: number;
  thread_id?: number;
  content: string;
  created_at: number;
  sender_name: string;
  avatar_url: string;
  reaction_count: number;
  reply_count?: number;
  has_thread?: boolean;
}

export interface ChannelMember {
  id: number;
  name: string;
  avatar_url: string;
  workspace_role: string;
  status: string;
  status_message: string;
}

export class MessageRepository {
  private readonly statements: Map<string, any> = new Map();
  private readonly db: Database;

  constructor(db: Database | DatabaseService) {
    this.db = db instanceof DatabaseService ? db.db : db;
    this.prepareStatements();
  }

  private prepareStatements() {
    this.statements.set(
      'hasChannelAccess',
      this.db.prepare(`
        SELECT 1 FROM channel_members 
        WHERE channel_id = ? AND user_id = ?
      `)
    );

    this.statements.set(
      'getChannelMessages',
      this.db.prepare(`
        SELECT 
          m.*,
          u.name as sender_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count,
          (SELECT COUNT(*) FROM messages WHERE thread_id = m.id) as reply_count,
          EXISTS(SELECT 1 FROM messages WHERE thread_id = m.id) as has_thread
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = ? 
        AND m.deleted_at IS NULL
        AND m.thread_id IS NULL
        AND m.id < ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `)
    );

    this.statements.set(
      'getChannelMessagesInitial',
      this.db.prepare(`
        SELECT 
          m.*,
          u.name as sender_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count,
          (SELECT COUNT(*) FROM messages WHERE thread_id = m.id) as reply_count,
          EXISTS(SELECT 1 FROM messages WHERE thread_id = m.id) as has_thread
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = ? 
        AND m.deleted_at IS NULL
        AND m.thread_id IS NULL
        ORDER BY m.created_at DESC
        LIMIT ?
      `)
    );

    this.statements.set(
      'updateLastRead',
      this.db.prepare(`
        UPDATE channel_members 
        SET last_read_at = unixepoch()
        WHERE channel_id = ? AND user_id = ?
      `)
    );

    this.statements.set(
      'getThreadMessages',
      this.db.prepare(`
        SELECT 
          m.*,
          u.name as sender_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = ?
        AND (m.id = ? OR m.thread_id = ?)
        AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
      `)
    );

    this.statements.set(
      'getChannelMembers',
      this.db.prepare(`
        SELECT 
          u.id,
          u.name,
          u.avatar_url,
          wu.role as workspace_role,
          wu.status,
          wu.status_message
        FROM channel_members cm
        JOIN users u ON cm.user_id = u.id
        JOIN workspace_users wu ON u.id = wu.user_id
        JOIN channels c ON cm.channel_id = c.id
        WHERE cm.channel_id = ?
        AND wu.workspace_id = c.workspace_id
        ORDER BY u.name ASC
      `)
    );

    this.statements.set(
      'createMessage',
      this.db.prepare(`
        INSERT INTO messages (workspace_id, channel_id, sender_id, content, thread_id, created_at)
        VALUES (?, ?, ?, ?, ?, unixepoch())
      `)
    );
  }

  private getStatement(name: string) {
    const stmt = this.statements.get(name);
    if (!stmt) {
      throw new Error(`Prepared statement '${name}' not found`);
    }
    return stmt;
  }

  hasChannelAccess(channelId: number, userId: number): boolean {
    return !!this.getStatement('hasChannelAccess').get(channelId, userId);
  }

  getChannelMessages(channelId: number, before?: number, limit: number = 50): Message[] {
    const stmt = before 
      ? this.getStatement('getChannelMessages')
      : this.getStatement('getChannelMessagesInitial');
      
    return before
      ? stmt.all(channelId, before, limit) as Message[]
      : stmt.all(channelId, limit) as Message[];
  }

  updateLastRead(channelId: number, userId: number): void {
    this.getStatement('updateLastRead').run(channelId, userId);
  }

  getThreadMessages(channelId: number, threadId: number): Message[] {
    return this.getStatement('getThreadMessages')
      .all(channelId, threadId, threadId) as Message[];
  }

  getChannelMembers(channelId: number): ChannelMember[] {
    return this.getStatement('getChannelMembers')
      .all(channelId) as ChannelMember[];
  }

  createMessage(params: {
    workspace_id: number;
    channel_id?: number;
    sender_id: number;
    content?: string;
    thread_id?: number;
  }): number {
    const result = this.getStatement('createMessage').run(
      params.workspace_id,
      params.channel_id || null,
      params.sender_id,
      params.content || null,
      params.thread_id || null
    );
    
    return Number(result.lastInsertRowid);
  }
}