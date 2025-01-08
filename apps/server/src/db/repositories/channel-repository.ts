import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Channel, ChannelMember, User, BaseModel, ChannelCreateDTO } from '@platica/shared/types';

type ChannelUpdateDTO = Partial<ChannelCreateDTO>;

interface ChannelWithMeta extends Channel {
  member_count: number;
  message_count: number;
  last_message_at: number | null;
  has_unread?: boolean;
  member_status?: 'member' | 'invited' | null;
}

interface ChannelMemberWithUser extends ChannelMember {
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
  workspace_role: string;
}

export class ChannelRepository extends BaseRepository<Channel, ChannelCreateDTO, ChannelUpdateDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return 'channels';
  }

  protected getJsonFields(): string[] {
    return ['settings'];
  }

  protected getBooleanFields(): string[] {
    return ['is_private', 'is_archived', 'is_muted'];
  }

  protected deserializeRow<T extends object>(row: T): T {
    const deserialized = super.deserializeRow(row);
    
    // Convert has_unread from number to boolean if it exists
    if ('has_unread' in deserialized) {
      deserialized.has_unread = !!deserialized.has_unread;
    }
    
    return deserialized;
  }

  async findByWorkspace(workspaceId: number, userId?: number): Promise<ChannelWithMeta[]> {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) as member_count,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.deleted_at IS NULL) as message_count,
        (SELECT MAX(created_at) FROM messages m WHERE m.channel_id = c.id AND m.deleted_at IS NULL) as last_message_at
        ${userId ? `
          ,CASE WHEN EXISTS(
            SELECT 1 FROM messages m 
            LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
            WHERE m.channel_id = c.id 
            AND m.deleted_at IS NULL
            AND (
              cm.last_read_at IS NULL 
              OR m.created_at > cm.last_read_at
            )
          ) THEN 1 ELSE 0 END as has_unread
          ,CASE 
            WHEN EXISTS(SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = ?) THEN 'member'
            WHEN EXISTS(SELECT 1 FROM channel_invites WHERE channel_id = c.id AND invitee_id = ?) THEN 'invited'
            ELSE NULL
          END as member_status
        ` : ''}
      FROM channels c
      WHERE c.workspace_id = ?
      AND (
        NOT c.is_private 
        ${userId ? 'OR EXISTS(SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = ?)' : ''}
      )
      ORDER BY c.name ASC
    `;

    const params = userId 
      ? [userId, userId, userId, workspaceId, userId]
      : [workspaceId];

    const results = this.db.prepare(query).all(...params) as ChannelWithMeta[];
    return results.map(result => this.deserializeRow(result));
  }

  async findWithMeta(channelId: number, userId?: number): Promise<ChannelWithMeta | undefined> {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) as member_count,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.deleted_at IS NULL) as message_count,
        (SELECT MAX(created_at) FROM messages m WHERE m.channel_id = c.id AND m.deleted_at IS NULL) as last_message_at
        ${userId ? `
          ,CASE WHEN EXISTS(
            SELECT 1 FROM messages m 
            WHERE m.channel_id = c.id 
            AND m.deleted_at IS NULL
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM channel_members WHERE channel_id = c.id AND user_id = ?),
              0
            )
          ) THEN 1 ELSE 0 END as has_unread
          ,CASE 
            WHEN EXISTS(SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = ?) THEN 'member'
            WHEN EXISTS(SELECT 1 FROM channel_invites WHERE channel_id = c.id AND invitee_id = ?) THEN 'invited'
            ELSE NULL
          END as member_status
        ` : ''}
      FROM channels c
      WHERE c.id = ?
    `;

    const params = userId 
      ? [userId, userId, userId, channelId]
      : [channelId];

    const result = this.db.prepare(query).get(...params) as ChannelWithMeta | undefined;
    return result ? this.deserializeRow(result) : undefined;
  }

  async findMembers(channelId: number): Promise<ChannelMemberWithUser[]> {
    const results = this.db.prepare(`
      SELECT 
        cm.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url,
        wu.role as workspace_role
      FROM channel_members cm
      JOIN users u ON cm.user_id = u.id
      JOIN channels c ON cm.channel_id = c.id
      LEFT JOIN workspace_users wu ON u.id = wu.user_id AND wu.workspace_id = c.workspace_id
      WHERE cm.channel_id = ?
      ORDER BY u.name ASC
    `).all(channelId) as ChannelMemberWithUser[];

    return results.map(result => this.deserializeRow({
      ...result,
      settings: typeof result.settings === 'string' ? JSON.parse(result.settings) : result.settings
    }));
  }

  async addMember(channelId: number, userId: number, role: string = 'member'): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO channel_members (channel_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(channelId, userId, role, '{}', now, now);
  }

  async updateMember(channelId: number, userId: number, data: { role?: string; last_read_at?: number }): Promise<void> {
    if (!data.role && !data.last_read_at) return;

    const now = Math.floor(Date.now() / 1000);
    const updates: string[] = [];
    const values: any[] = [];

    if (data.role) {
      updates.push('role = ?');
      values.push(data.role);
    }

    if (data.last_read_at) {
      updates.push('last_read_at = ?');
      values.push(data.last_read_at);
    }

    updates.push('updated_at = ?');
    values.push(now);

    this.db.prepare(`
      UPDATE channel_members
      SET ${updates.join(', ')}
      WHERE channel_id = ? AND user_id = ?
    `).run(...values, channelId, userId);
  }

  async removeMember(channelId: number, userId: number): Promise<void> {
    this.db.prepare(`
      DELETE FROM channel_members
      WHERE channel_id = ? AND user_id = ?
    `).run(channelId, userId);
  }

  async getMemberRole(channelId: number, userId: number): Promise<string | undefined> {
    const result = this.db.prepare(`
      SELECT role FROM channel_members
      WHERE channel_id = ? AND user_id = ?
    `).get(channelId, userId) as { role: string } | undefined;

    return result?.role;
  }

  async canAccess(channelId: number, userId: number): Promise<boolean> {
    try {
      // First check if user is already a member
      const isMember = this.db.prepare(`
        SELECT 1 FROM channel_members 
        WHERE channel_id = ? AND user_id = ?
      `).get(channelId, userId);

      if (isMember) {
        return true;
      }

      // If not a member, check if it's a public channel
      const channel = this.db.prepare(`
        SELECT is_private FROM channels
        WHERE id = ?
      `).get(channelId) as { is_private: boolean } | undefined;

      // Channel doesn't exist
      if (!channel) {
        return false;
      }

      // Allow access if channel is public
      return !channel.is_private;
    } catch (error) {
      console.error('Error checking channel access:', error);
      return false;
    }
  }
}