import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Channel, ChannelMember, User, BaseModel, CreateChannelDTO, UpdateChannelDTO } from '@models';
import type { ChannelWithMeta, ChannelMemberWithUser } from '../../types/repository';

export class ChannelRepository extends BaseRepository<Channel, CreateChannelDTO, UpdateChannelDTO> {
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
    return ['isArchived', 'isMuted'];
  }


  async findByWorkspace(workspaceId: number, userId?: number): Promise<ChannelWithMeta[]> {
    try {
      console.log('Finding channels for workspace:', workspaceId, 'user:', userId);
      
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
        ${userId ? 'AND EXISTS(SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = ?)' : ''}
        ORDER BY c.name ASC
      `;

      const params = userId 
        ? [userId, userId, userId, workspaceId, userId]
        : [workspaceId];

      console.log('Executing query with params:', params);
      console.log('Query:', query);
      
      const results = this.db.prepare(query).all(...params) as ChannelWithMeta[];
      console.log('Found channels:', results?.length || 0);
      
      return results
    } catch (error) {
      console.error('Error in findByWorkspace:', error);
      throw error;
    }
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
    return result 
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

    return results
  }

  async addMember(channelId: number, userId: number, role: string = 'member'): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO channel_members (channel_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(channelId, userId, role, '{}', now, now);
  }

  async updateMember(channelId: number, userId: number, data: { role?: string; lastReadAt?: number }): Promise<void> {
    if (!data.role && !data.lastReadAt) return;

    const now = Math.floor(Date.now() / 1000);
    const updates: string[] = [];
    const values: any[] = [];

    if (data.role) {
      updates.push('role = ?');
      values.push(data.role);
    }

    if (data.lastReadAt) {
      updates.push('last_read_at = ?');
      values.push(data.lastReadAt);
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
      // Check if user is a member
      const isMember = this.db.prepare(`
        SELECT 1 FROM channel_members 
        WHERE channel_id = ? AND user_id = ?
      `).get(channelId, userId);

      return !!isMember;
    } catch (error) {
      console.error('Error checking channel access:', error);
      return false;
    }
  }
}