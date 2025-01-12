import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { 
  Room, 
  RoomMember, 
  ApiRoom, 
  ApiRoomMember,
  CreateRoomDTO, 
  UpdateRoomDTO 
} from "@models/room";
import { RoomSchema } from "@models/schemas"; // NEW
import { ApiError } from "../../api/base-controller";

export class RoomRepository extends BaseRepository<Room, CreateRoomDTO, UpdateRoomDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return "rooms";
  }

  protected getJsonFields(): string[] {
    return ["settings"];
  }

  protected getBooleanFields(): string[] {
    return []; // If we had isArchived, we'd add it here
  }

  /**
   * Let's parse the row with RoomSchema
   */
  protected deserializeRow<D extends object>(data: D): Room {
    const base = super.deserializeRow(data);

    // Construct partial for Zod
    const candidate = {
      id: String(base.id),
      workspaceId: String((base as any).workspaceId),
      name: base.name,
      description: base.description || '',
      scheduledStart: String((base as any).scheduledStart),
      scheduledEnd: String((base as any).scheduledEnd),
      startedAt: (base as any).startedAt ? String((base as any).startedAt) : undefined,
      endedAt: (base as any).endedAt ? String((base as any).endedAt) : undefined,
      status: (base as any).status || 'scheduled',
      createdBy: String((base as any).createdBy),
      settings: base.settings || {},
      createdAt: new Date((base as any).createdAt * 1000).toISOString(),
      updatedAt: new Date((base as any).updatedAt * 1000).toISOString(),
      deletedAt: null
    };

    try {
      const parsed = RoomSchema.parse(candidate);
      // Then map back to domain style if domain expects numeric IDs/timestamps
      return {
        ...base,
        id: Number(parsed.id),
        workspaceId: Number(parsed.workspaceId),
        createdBy: Number(parsed.createdBy),
        status: parsed.status,
        // keep numeric timestamps if domain does so
      } as Room;
    } catch (error) {
      console.error("Failed to parse Room row with Zod:", error);
      throw error;
    }
  }

  async getRoomWithMeta(roomId: number, userId?: number): Promise<ApiRoom | undefined> {
    const query = `
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM room_members rm2 
         WHERE rm2.room_id = r.id AND rm2.left_at IS NULL) as current_members,
        (SELECT COUNT(*) FROM room_members rm3 
         WHERE rm3.room_id = r.id) as total_joined
        ${userId ? ", rm.role" : ""}
      FROM rooms r
      ${userId ? "LEFT JOIN room_members rm ON r.id = rm.room_id AND rm.user_id = ?" : ""}
      WHERE r.id = ?
      AND r.deleted_at IS NULL
    `;

    const params = userId ? [userId, roomId] : [roomId];
    const result = this.db.prepare(query).get(...params);
    if (!result) return undefined;

    // parse row
    const deserialized = this.deserializeRow(result);
    return {
      ...deserialized,
      currentMembers: Number(result.current_members),
      totalJoined: Number(result.total_joined)
    } as ApiRoom;
  }

  async findActiveByWorkspace(workspaceId: number): Promise<ApiRoom[]> {
    const rows = this.db.prepare(`
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM room_members rm2 
         WHERE rm2.room_id = r.id AND rm2.left_at IS NULL) as current_members,
        (SELECT COUNT(*) FROM room_members rm3 
         WHERE rm3.room_id = r.id) as total_joined
      FROM rooms r
      WHERE r.workspace_id = ?
        AND r.deleted_at IS NULL
        AND r.status IN ('scheduled', 'active')
      ORDER BY r.scheduled_start ASC
    `).all(workspaceId) as any[];

    return rows.map(row => {
      const deserialized = this.deserializeRow(row);
      return {
        ...deserialized,
        currentMembers: Number(row.current_members),
        totalJoined: Number(row.total_joined)
      } as ApiRoom;
    });
  }

  async getRoomMembers(roomId: number): Promise<ApiRoomMember[]> {
    const results = this.db.prepare(`
      SELECT 
        rm.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ?
        AND rm.left_at IS NULL
      ORDER BY rm.joined_at ASC
    `).all(roomId) as any[];

    return results.map((row) => ({
      ...row,
      state: typeof row.state === "string" ? JSON.parse(row.state) : row.state,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatarUrl: row.user_avatar_url
      }
    }));
  }

  async addMember(roomId: number, userId: number, role: RoomMember["role"]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    // Add checks if user can only be in one active room, etc.
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO room_members (
          room_id, user_id, role, joined_at, state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        roomId,
        userId,
        role,
        now,
        JSON.stringify({
          online: true,
          audio: false,
          video: false,
          sharing: false,
          handRaised: false,
        }),
        now,
        now
      );
    })();
  }

  async updateMemberState(
    roomId: number,
    userId: number,
    state: Partial<RoomMember["state"]>
  ): Promise<RoomMember | undefined> {
    const now = Math.floor(Date.now() / 1000);
    const member = this.db.prepare(`
      SELECT * FROM room_members
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).get(roomId, userId) as any | null;

    if (!member) return undefined;

    const currentState = typeof member.state === "string" 
      ? JSON.parse(member.state) 
      : member.state;

    const newState = { ...currentState, ...state };
    const result = this.db.prepare(`
      UPDATE room_members
      SET state = ?, updated_at = ?
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL
      RETURNING *
    `).get(JSON.stringify(newState), now, roomId, userId) as any | null;

    if (!result) return undefined;
    return {
      ...result,
      state: newState
    } as RoomMember;
  }
}