import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Hub, CreateHubDTO, UpdateHubDTO } from '@models';
import type { HubWithMeta, HubMemberWithUser } from '../../types/repository';

export class HubRepository extends BaseRepository<Hub, CreateHubDTO, UpdateHubDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return 'hubs';
  }

  protected getJsonFields(): string[] {
    return ['settings'];
  }

  protected getBooleanFields(): string[] {
    return ['isArchived', 'isMuted'];
  }


  async findByWorkspace(workspaceId: number, userId?: number): Promise<HubWithMeta[]> {
    try {
      console.log('Finding hubs for workspace:', workspaceId, 'user:', userId);
      
      const query = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM hub_members cm WHERE cm.hub_id = c.id) as member_count,
          (SELECT COUNT(*) FROM messages m WHERE m.hub_id = c.id AND m.deleted_at IS NULL) as message_count,
          (SELECT MAX(created_at) FROM messages m WHERE m.hub_id = c.id AND m.deleted_at IS NULL) as last_message_at
          ${userId ? `
            ,CASE WHEN EXISTS(
              SELECT 1 FROM messages m 
              LEFT JOIN hub_members cm ON cm.hub_id = c.id AND cm.user_id = ?
              WHERE m.hub_id = c.id 
              AND m.deleted_at IS NULL
              AND (
                cm.last_read_at IS NULL 
                OR m.created_at > cm.last_read_at
              )
            ) THEN 1 ELSE 0 END as has_unread
            ,CASE 
              WHEN EXISTS(SELECT 1 FROM hub_members WHERE hub_id = c.id AND user_id = ?) THEN 'member'
              WHEN EXISTS(SELECT 1 FROM hub_invites WHERE hub_id = c.id AND invitee_id = ?) THEN 'invited'
              ELSE NULL
            END as member_status
          ` : ''}
        FROM hubs c
        WHERE c.workspace_id = ?
        ${userId ? 'AND EXISTS(SELECT 1 FROM hub_members WHERE hub_id = c.id AND user_id = ?)' : ''}
        ORDER BY c.name ASC
      `;

      const params = userId 
        ? [userId, userId, userId, workspaceId, userId]
        : [workspaceId];

      console.log('Executing query with params:', params);
      console.log('Query:', query);
      
      const results = this.db.prepare(query).all(...params) as HubWithMeta[];
      console.log('Found hubs:', results?.length || 0);
      
      return results
    } catch (error) {
      console.error('Error in findByWorkspace:', error);
      throw error;
    }
  }

  async findWithMeta(hubId: number, userId?: number): Promise<HubWithMeta | undefined> {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM hub_members cm WHERE cm.hub_id = c.id) as member_count,
        (SELECT COUNT(*) FROM messages m WHERE m.hub_id = c.id AND m.deleted_at IS NULL) as message_count,
        (SELECT MAX(created_at) FROM messages m WHERE m.hub_id = c.id AND m.deleted_at IS NULL) as last_message_at
        ${userId ? `
          ,CASE WHEN EXISTS(
            SELECT 1 FROM messages m 
            WHERE m.hub_id = c.id 
            AND m.deleted_at IS NULL
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM hub_members WHERE hub_id = c.id AND user_id = ?),
              0
            )
          ) THEN 1 ELSE 0 END as has_unread
          ,CASE 
            WHEN EXISTS(SELECT 1 FROM hub_members WHERE hub_id = c.id AND user_id = ?) THEN 'member'
            WHEN EXISTS(SELECT 1 FROM hub_invites WHERE hub_id = c.id AND invitee_id = ?) THEN 'invited'
            ELSE NULL
          END as member_status
        ` : ''}
      FROM hubs c
      WHERE c.id = ?
    `;

    const params = userId 
      ? [userId, userId, userId, hubId]
      : [hubId];

    const result = this.db.prepare(query).get(...params) as HubWithMeta | undefined;
    return result 
  }

  async findMembers(hubId: number): Promise<HubMemberWithUser[]> {
    const results = this.db.prepare(`
      SELECT 
        cm.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url,
        wu.role as workspace_role
      FROM hub_members cm
      JOIN users u ON cm.user_id = u.id
      JOIN hubs c ON cm.hub_id = c.id
      LEFT JOIN workspace_users wu ON u.id = wu.user_id AND wu.workspace_id = c.workspace_id
      WHERE cm.hub_id = ?
      ORDER BY u.name ASC
    `).all(hubId) as HubMemberWithUser[];

    return results
  }

  async addMember(hubId: number, userId: number, role: string = 'member'): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO hub_members (hub_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(hubId, userId, role, '{}', now, now);
  }

  async updateMember(hubId: number, userId: number, data: { role?: string; lastReadAt?: number }): Promise<void> {
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
      UPDATE hub_members
      SET ${updates.join(', ')}
      WHERE hub_id = ? AND user_id = ?
    `).run(...values, hubId, userId);
  }

  async removeMember(hubId: number, userId: number): Promise<void> {
    this.db.prepare(`
      DELETE FROM hub_members
      WHERE hub_id = ? AND user_id = ?
    `).run(hubId, userId);
  }

  async getMemberRole(hubId: number, userId: number): Promise<string | undefined> {
    const result = this.db.prepare(`
      SELECT role FROM hub_members
      WHERE hub_id = ? AND user_id = ?
    `).get(hubId, userId) as { role: string } | undefined;

    return result?.role;
  }

  async canAccess(hubId: number, userId: number): Promise<boolean> {
    try {
      // Check if user is a member
      const isMember = this.db.prepare(`
        SELECT 1 FROM hub_members 
        WHERE hub_id = ? AND user_id = ?
      `).get(hubId, userId);

      return !!isMember;
    } catch (error) {
      console.error('Error checking hub
 access:', error);
      return false;
    }
  }
}