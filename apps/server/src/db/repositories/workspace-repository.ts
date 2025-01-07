import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { Workspace, WorkspaceMember, User, BaseModel, WorkspaceCreateDTO } from '@platica/shared/types';
import { UserRole } from '@platica/shared/types';

type WorkspaceUpdateDTO = Partial<WorkspaceCreateDTO>;

interface WorkspaceWithMeta extends Workspace {
  member_count: number;
  channel_count: number;
  role?: UserRole;
}

interface WorkspaceMemberWithUser extends WorkspaceMember {
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
}

interface WorkspaceInvite extends BaseModel {
  workspace_id: number;
  inviter_id: number;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'rejected';
}

type WorkspaceInviteCreateDTO = {
  workspace_id: number;
  inviter_id: number;
  email: string;
  role: UserRole;
};

export class WorkspaceRepository extends BaseRepository<Workspace, WorkspaceCreateDTO, WorkspaceUpdateDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return 'workspaces';
  }

  protected getJsonFields(): string[] {
    return ['settings'];
  }

  async findBySlug(slug: string): Promise<Workspace | undefined> {
    const result = this.db
      .prepare('SELECT * FROM workspaces WHERE slug = ?')
      .get(slug) as Workspace | null;
    
    return result ? this.deserializeRow(result) : undefined;
  }

  async getWorkspaceWithMeta(workspaceId: number, userId?: number): Promise<WorkspaceWithMeta | undefined> {
    const query = `
      SELECT 
        w.*,
        (SELECT COUNT(*) FROM workspace_users wu2 WHERE wu2.workspace_id = w.id) as member_count,
        (SELECT COUNT(*) FROM channels c WHERE c.workspace_id = w.id) as channel_count
        ${userId ? ', wu.role' : ''}
      FROM workspaces w
      ${userId ? 'LEFT JOIN workspace_users wu ON w.id = wu.workspace_id AND wu.user_id = ?' : ''}
      WHERE w.id = ?
    `;

    const params = userId ? [userId, workspaceId] : [workspaceId];
    const result = this.db.prepare(query).get(...params) as WorkspaceWithMeta | null;
    return result ? this.deserializeRow(result) : undefined;
  }

  async getUserWorkspaces(userId: number): Promise<WorkspaceWithMeta[]> {
    const results = this.db.prepare(`
      SELECT 
        w.*,
        wu.role,
        (SELECT COUNT(*) FROM workspace_users wu2 WHERE wu2.workspace_id = w.id) as member_count,
        (SELECT COUNT(*) FROM channels c WHERE c.workspace_id = w.id) as channel_count
      FROM workspaces w
      JOIN workspace_users wu ON w.id = wu.workspace_id
      WHERE wu.user_id = ?
      ORDER BY w.name ASC
    `).all(userId) as WorkspaceWithMeta[];

    return results.map(result => this.deserializeRow(result));
  }

  async getWorkspaceUsers(workspaceId: number): Promise<WorkspaceMemberWithUser[]> {
    const results = this.db.prepare(`
      SELECT 
        wu.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url
      FROM workspace_users wu
      JOIN users u ON wu.user_id = u.id
      WHERE wu.workspace_id = ?
      ORDER BY u.name ASC
    `).all(workspaceId) as WorkspaceMemberWithUser[];

    return results.map(result => ({
      ...result,
      settings: typeof result.settings === 'string' ? JSON.parse(result.settings) : result.settings
    }));
  }

  async addUser(workspaceId: number, userId: number, role: UserRole = UserRole.MEMBER): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO workspace_users (workspace_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(workspaceId, userId, role, '{}', now, now);
  }

  async updateUser(workspaceId: number, userId: number, data: {
    role?: UserRole;
    display_name?: string;
    status?: string;
    status_message?: string;
    notification_preferences?: string;
  }): Promise<WorkspaceMember | undefined> {
    const now = Math.floor(Date.now() / 1000);
    const updates: string[] = [];
    const values: any[] = [];

    if (data.role) {
      updates.push('role = ?');
      values.push(data.role);
    }

    // Store user preferences in settings JSON
    if (data.display_name || data.status || data.status_message || data.notification_preferences) {
      const member = this.db.prepare(`
        SELECT settings FROM workspace_users
        WHERE workspace_id = ? AND user_id = ?
      `).get(workspaceId, userId) as WorkspaceMember | null;

      const currentSettings = member?.settings ? 
        (typeof member.settings === 'string' ? JSON.parse(member.settings) : member.settings) : 
        {};

      const newSettings = {
        ...currentSettings,
        ...(data.display_name && { display_name: data.display_name }),
        ...(data.status && { status: data.status }),
        ...(data.status_message && { status_message: data.status_message }),
        ...(data.notification_preferences && { notification_preferences: data.notification_preferences })
      };

      updates.push('settings = ?');
      values.push(JSON.stringify(newSettings));
    }

    if (updates.length === 0) return;

    updates.push('updated_at = ?');
    values.push(now);

    const result = this.db.prepare(`
      UPDATE workspace_users
      SET ${updates.join(', ')}
      WHERE workspace_id = ? AND user_id = ?
      RETURNING *
    `).get(...values, workspaceId, userId) as WorkspaceMember | null;

    return result ? {
      ...result,
      settings: typeof result.settings === 'string' ? JSON.parse(result.settings) : result.settings
    } : undefined;
  }

  async removeUser(workspaceId: number, userId: number): Promise<void> {
    await this.transaction(async () => {
      // Remove from channels first
      this.db.prepare(`
        DELETE FROM channel_members
        WHERE user_id = ?
        AND channel_id IN (
          SELECT id FROM channels WHERE workspace_id = ?
        )
      `).run(userId, workspaceId);

      // Then remove from workspace
      this.db.prepare(`
        DELETE FROM workspace_users
        WHERE workspace_id = ? AND user_id = ?
      `).run(workspaceId, userId);
    });
  }

  async createInvite(data: WorkspaceInviteCreateDTO): Promise<WorkspaceInvite> {
    const now = Math.floor(Date.now() / 1000);
    return this.db.prepare(`
      INSERT INTO workspace_invites (
        workspace_id,
        inviter_id,
        email,
        role,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      data.workspace_id,
      data.inviter_id,
      data.email,
      data.role,
      'pending',
      now,
      now
    ) as WorkspaceInvite;
  }

  async getMemberRole(workspaceId: number, userId: number): Promise<UserRole | undefined> {
    const result = this.db.prepare(`
      SELECT role FROM workspace_users
      WHERE workspace_id = ? AND user_id = ?
    `).get(workspaceId, userId) as { role: UserRole } | null;

    return result?.role;
  }
} 