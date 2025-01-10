import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type {
  Room,
  RoomMember,
  User,
  CreateRoomDTO,
  UpdateRoomDTO,
  ApiRoom,
  ApiRoomMember,
} from "@models";

export class RoomRepository extends BaseRepository<
  Room,
  CreateRoomDTO,
  UpdateRoomDTO
> {
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
    return [];
  }

  async getRoomWithMeta(
    roomId: number,
    userId?: number
  ): Promise<ApiRoom | undefined> {
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
      WHERE r.id = ? AND r.deleted_at IS NULL
    `;

    const params = userId ? [userId, roomId] : [roomId];
    const result = this.db.prepare(query).get(...params) as ApiRoom;
    return result;
  }

  async findActiveByWorkspace(workspaceId: number): Promise<ApiRoom[]> {
    const results = this.db
      .prepare(
        `
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
    `
      )
      .all(workspaceId) as ApiRoom[];

    return results;
  }
  async getRoomMembers(roomId: number): Promise<ApiRoomMember[]> {
    const results = this.db
      .prepare(
        `
      SELECT 
        rm.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar_url
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ? AND rm.left_at IS NULL
      ORDER BY rm.joined_at ASC
    `
      )
      .all(roomId) as ApiRoomMember[];

    return results.map((result) => ({
      ...result,
      state:
        typeof result.state === "string"
          ? JSON.parse(result.state)
          : result.state,
    }));
  }

  async addMember(
    roomId: number,
    userId: number,
    role: RoomMember["role"]
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await this.transaction(async () => {
      // Check if user is already in another active room
      const activeRoom = this.db
        .prepare(
          `
        SELECT r.id 
        FROM rooms r
        JOIN room_members rm ON r.id = rm.room_id
        WHERE rm.user_id = ? 
          AND rm.left_at IS NULL
          AND r.status = 'active'
          AND r.deleted_at IS NULL
      `
        )
        .get(userId) as { id: number } | null;

      if (activeRoom) {
        throw new Error("User can only be in one active room at a time");
      }

      // Add to room
      this.db
        .prepare(
          `
        INSERT INTO room_members (
          room_id, user_id, role, joined_at, state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
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
    });
  }

  async updateMemberState(
    roomId: number,
    userId: number,
    state: Partial<RoomMember["state"]>
  ): Promise<RoomMember | undefined> {
    const now = Math.floor(Date.now() / 1000);

    const member = this.db
      .prepare(
        `
      SELECT * FROM room_members
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `
      )
      .get(roomId, userId) as RoomMember | null;

    if (!member) return undefined;

    const currentState =
      typeof member.state === "string"
        ? JSON.parse(member.state)
        : member.state;

    const newState = { ...currentState, ...state };

    const result = this.db
      .prepare(
        `
      UPDATE room_members
      SET state = ?, updated_at = ?
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL
      RETURNING *
    `
      )
      .get(JSON.stringify(newState), now, roomId, userId) as RoomMember | null;

    return result
      ? {
          ...result,
          state:
            typeof result.state === "string"
              ? JSON.parse(result.state)
              : result.state,
        }
      : undefined;
  }

  async removeMember(roomId: number, userId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.db
      .prepare(
        `
      UPDATE room_members
      SET left_at = ?, updated_at = ?
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `
      )
      .run(now, now, roomId, userId);
  }

  async getMemberRole(
    roomId: number,
    userId: number
  ): Promise<RoomMember["role"] | undefined> {
    const result = this.db
      .prepare(
        `
      SELECT role FROM room_members
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `
      )
      .get(roomId, userId) as { role: RoomMember["role"] } | null;

    return result?.role;
  }
}
