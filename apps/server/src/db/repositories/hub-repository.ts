import type { Database } from 'bun:sqlite';
import { BaseRepository } from './base';
import type { BaseModel } from '@models';
import type { ValidatedUnixTimestamp } from '@types';

export interface Hub extends BaseModel {
  id: number;
  workspaceId: number;
  name: string;
  description?: string;
  isArchived: boolean;
  createdBy: number;
  settings: Record<string, unknown>;
  createdAt: ValidatedUnixTimestamp;
  updatedAt: ValidatedUnixTimestamp;
}

export interface CreateHubDTO {
  workspaceId: number;
  name: string;
  description?: string;
  isArchived: boolean;
  createdBy: number;
  settings: Record<string, unknown>;
}

export class HubRepository extends BaseRepository<Hub, CreateHubDTO> {
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

  async findByWorkspace(workspaceId: number, userId: number): Promise<Hub[]> {
    const results = this.db.prepare(
      `SELECT h.* FROM hubs h
       JOIN hub_members hm ON h.id = hm.hub_id
       WHERE h.workspace_id = ? AND hm.user_id = ?`
    ).all(workspaceId, userId) as any[];
    
    return results.map(result => this.deserializeRow(result));
  }

  async getMemberRole(hubId: number, userId: number): Promise<string | null> {
    const result = this.db.prepare(
      'SELECT role FROM hub_members WHERE hub_id = ? AND user_id = ?'
    ).get(hubId, userId) as { role: string } | null;
    
    return result?.role || null;
  }

  async addMember(hubId: number, userId: number, role: string = 'member'): Promise<void> {
    await this.db.prepare(
      'INSERT INTO hub_members (hub_id, user_id, role) VALUES (?, ?, ?)'
    ).run(hubId, userId, role);
  }

  async removeMember(hubId: number, userId: number): Promise<void> {
    await this.db.prepare(
      'DELETE FROM hub_members WHERE hub_id = ? AND user_id = ?'
    ).run(hubId, userId);
  }

  async findMembers(hubId: number): Promise<{ userId: number; role: string }[]> {
    return this.db.prepare(
      'SELECT user_id as userId, role FROM hub_members WHERE hub_id = ?'
    ).all(hubId) as { userId: number; role: string }[];
  }

  async updateMember(hubId: number, userId: number, updates: { lastReadAt?: number }): Promise<void> {
    if (updates.lastReadAt) {
      await this.db.prepare(
        'UPDATE hub_members SET last_read_at = ? WHERE hub_id = ? AND user_id = ?'
      ).run(updates.lastReadAt, hubId, userId);
    }
  }
} 