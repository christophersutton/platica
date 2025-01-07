import { Database } from 'bun:sqlite';
import { DatabaseService } from './database';

export interface Channel {
  id: number;
  workspace_id: number;
  name: string;
  description: string;
  is_private: boolean;
  is_archived: boolean;
  created_by: number;
  created_at: number;
  member_count: number;
  is_muted: boolean;
  unread_count: number;
}

export class ChannelRepository {
  private readonly db: Database;

  constructor(db: Database | DatabaseService) {
    this.db = db instanceof DatabaseService ? db.db : db;
  }

  hasChannelAccess(channelId: number, userId: number): boolean {
    return !!this.db.prepare(`
      SELECT 1 FROM channel_members 
      WHERE channel_id = ? AND user_id = ?
    `).get(channelId, userId);
  }

  getUserWorkspaceRole(workspaceId: number, userId: number): string | null {
    const result = this.db.prepare(`
      SELECT role FROM workspace_users 
      WHERE workspace_id = ? AND user_id = ?
    `).get(workspaceId, userId) as { role: string } | undefined;
    return result?.role ?? null;
  }

  getWorkspaceChannels(workspaceId: number, userId: number, userRole: string): Channel[] {
    return this.db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count,
        cm.is_muted,
        (
          SELECT COUNT(*) FROM messages m 
          WHERE m.channel_id = c.id 
          AND m.created_at > COALESCE(cm.last_read_at, 0)
          AND m.deleted_at IS NULL
        ) as unread_count
      FROM channels c
      LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
      WHERE c.workspace_id = ?
      AND (
        c.is_private = 0 
        OR EXISTS (
          SELECT 1 FROM channel_members 
          WHERE channel_id = c.id AND user_id = ?
        )
        OR ? = 'admin'
      )
      AND c.is_archived = 0
      ORDER BY 
        COALESCE(cm.last_read_at, 0) DESC,
        c.name ASC
    `).all(userId, workspaceId, userId, userRole) as Channel[];
  }

  createChannel(params: {
    workspaceId: number;
    name: string;
    description: string;
    isPrivate: boolean;
    createdBy: number;
  }): Channel {
    const { workspaceId, name, description, isPrivate, createdBy } = params;
    
    return this.db.transaction(() => {
      // Create the channel
      const result = this.db.prepare(`
        INSERT INTO channels (workspace_id, name, description, is_private, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
      `).run(workspaceId, name, description, isPrivate, createdBy);

      const channelId = Number(result.lastInsertRowid);

      // Add creator as channel member
      this.db.prepare(`
        INSERT INTO channel_members (channel_id, user_id, created_at)
        VALUES (?, ?, unixepoch())
      `).run(channelId, createdBy);

      return {
        id: channelId,
        workspace_id: workspaceId,
        name,
        description,
        is_private: isPrivate,
        is_archived: false,
        created_by: createdBy,
        created_at: Math.floor(Date.now() / 1000),
        member_count: 1,
        is_muted: false,
        unread_count: 0
      };
    })();
  }
}