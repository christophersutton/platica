import type { Database } from 'bun:sqlite';
import { BaseRepository } from './base';
import type { Hub, CreateHubDTO, UpdateHubDTO } from '@models/hub';
import type { HubWithMeta, HubMemberWithUser } from '../../types/repository';
import { HubSchema } from '@models/schemas';  // NEW import
import { ApiError } from '../../api/base-controller';

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
    return ['isArchived'];
  }

  /**
   * Override to parse row with the Zod HubSchema
   */
  protected deserializeRow<D extends object>(data: D): Hub {
    const base = super.deserializeRow(data);

    // We assemble a candidate for HubSchema:
    // We'll do minimal bridging. The DB might store numeric timestamps, 
    // but HubSchema wants them as strings (for createdAt, updatedAt).
    // We'll do a naive conversion: numeric -> new Date -> toISOString.
    const candidate = {
      id: String(base.id),
      workspaceId: String((base as any).workspaceId),
      name: base.name,
      description: base.description ?? undefined,
      topic: (base as any).topic ?? undefined,
      isArchived: !!base.isArchived,
      createdBy: String((base as any).createdBy),
      settings: base.settings || {},
      createdAt: new Date((base as any).createdAt * 1000).toISOString(),
      updatedAt: new Date((base as any).updatedAt * 1000).toISOString()
    };

    try {
      const parsed = HubSchema.parse(candidate);
      // map parsed object back to domain shape
      return {
        // Keep numeric IDs where domain expects them
        ...base,
        id: Number(parsed.id),
        workspaceId: Number(parsed.workspaceId),
        createdBy: Number(parsed.createdBy),
        isArchived: parsed.isArchived,
        // Keep numeric timestamps in domain if desired
      } as Hub;
    } catch (error) {
      console.error('Failed to parse Hub row with Zod:', error);
      throw error;
    }
  }

  async findByWorkspace(workspaceId: number, userId?: number): Promise<HubWithMeta[]> {
    try {
      const query = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM hub_members cm WHERE cm.hub_id = c.id) as member_count,
          (SELECT COUNT(*) FROM messages m WHERE m.hub_id = c.id AND m.deleted_at IS NULL) as message_count,
          (SELECT MAX(created_at) FROM messages m WHERE m.hub_id = c.id AND m.deleted_at IS NULL) as last_message_at
          ${
            userId 
              ? `
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
                    ELSE NULL
                  END as member_status
                `
              : ''
          }
        FROM hubs c
        WHERE c.workspace_id = ?
        ${ userId ? 'AND EXISTS(SELECT 1 FROM hub_members WHERE hub_id = c.id AND user_id = ?)' : '' }
        ORDER BY c.name ASC
      `;

      const params = userId 
        ? [userId, userId, workspaceId, userId]
        : [workspaceId];

      const rows = this.db.prepare(query).all(...params) as (HubWithMeta & Record<string, any>)[];
      
      const hubs: HubWithMeta[] = rows.map((row) => {
        const baseHub = this.deserializeRow(row);
        return {
          ...baseHub,
          member_count: Number(row.member_count),
          message_count: Number(row.message_count),
          last_message_at: row.last_message_at ? Number(row.last_message_at) : null,
          has_unread: row.has_unread ? !!row.has_unread : false,
          member_status: row.member_status || null
        } as HubWithMeta;
      });

      return hubs;
    } catch (error) {
      console.error('Error in findByWorkspace:', error);
      throw error;
    }
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

    return results.map((row) => ({
      ...row,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings
    }));
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
}