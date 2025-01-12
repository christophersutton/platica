import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { RoomRepository } from '../../db/repositories/room-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import { WebSocketService } from '../../services/websockets';
import { RoomEventType, WSEventType } from '@websockets';
import type { RoomEvent } from '@websockets';
import { z } from 'zod';

// new Zod schemas for creation and update
const createRoomSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  scheduled_start: z.number(),
  scheduled_end: z.number(),
  settings: z.object({
    autoRecord: z.boolean().optional(),
    retention: z.object({
      chatDays: z.number().optional(),
      recordingDays: z.number().optional()
    }).optional(),
    secretary: z.object({
      enabled: z.boolean(),
      capabilities: z.array(z.string())
    }).optional()
  }).partial().optional()
});

interface UpdateMemberStateBody {
  audio?: boolean;
  video?: boolean;
  sharing?: boolean;
  handRaised?: boolean;
}

export class RoomController extends BaseController {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly wsService: WebSocketService
  ) {
    super();
  }

  static create(dbProvider: DatabaseProvider): RoomController {
    return new RoomController(
      new RoomRepository(dbProvider.db),
      WebSocketService.getInstance()
    );
  }

  getWorkspaceRooms = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const rooms = await this.roomRepo.findActiveByWorkspace(workspaceId);
      return { rooms };
    });
  };

  createRoom = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const workspaceId = this.requireNumberParam(c, 'workspaceId');
      const { userId } = this.requireUser(c);
      const body = await c.req.json();

      const parsed = createRoomSchema.parse(body);

      const newRoom = await this.roomRepo.create({
        workspaceId,
        name: parsed.name,
        description: parsed.description,
        scheduledStart: parsed.scheduled_start,
        scheduledEnd: parsed.scheduled_end,
        status: 'scheduled',
        createdBy: userId,
        settings: parsed.settings || {}
      });

      await this.roomRepo.addMember(newRoom.id, userId, 'host');

      this.wsService.broadcastToWorkspace(workspaceId, {
        type: WSEventType.ROOM,
        payload: { 
          room: newRoom,
          roomEventType: RoomEventType.ROOM_CREATED
         }
      } as RoomEvent);

      return { room: newRoom };
    });
  };

  getRoomDetails = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);
      const room = await this.roomRepo.getRoomWithMeta(roomId, userId);
      if (!room) {
        throw new ApiError('Room not found', 404);
      }
      const members = await this.roomRepo.getRoomMembers(roomId);
      return { room: { ...room, members } };
    });
  };

  updateRoom = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);
      const body = await c.req.json();

      // Possibly parse with an updateRoomSchema if you have it
      // check if user is host
      const role = await this.roomRepo.getMemberRole(roomId, userId);
      if (role !== 'host') {
        throw new ApiError('Only room host can update settings', 403);
      }

      const updated = await this.roomRepo.update(roomId, {
        name: body.name,
        description: body.description,
        scheduledEnd: body.scheduled_end,
        settings: body.settings
      });
      if (!updated) {
        throw new ApiError('Failed to update room', 500);
      }

      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM_UPDATED,
        payload: { room: updated }
      } as RoomEvent);

      return { room: updated };
    });
  };

  joinRoom = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);
      await this.roomRepo.addMember(roomId, userId, 'participant');
      const room = await this.roomRepo.getRoomWithMeta(roomId, userId);
      const members = await this.roomRepo.getRoomMembers(roomId);

      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM_MEMBER_JOINED,
        payload: { roomId, userId }
      } as RoomEvent);

      return { room: { ...room, members } };
    });
  };

  leaveRoom = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);
      await this.roomRepo.removeMember(roomId, userId);
      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM,
        payload: { roomId, userId, roomEventType: RoomEventType.ROOM_MEMBER_REMOVED }
      } as RoomEvent);
      return { success: true };
    });
  };

  updateMemberState = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);
      const body = await c.req.json<UpdateMemberStateBody>();
      const updated = await this.roomRepo.updateMemberState(roomId, userId, body);
      if (!updated) {
        throw new ApiError('Member not found', 404);
      }
      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM,
        payload: { roomId, userId, roomEventType: RoomEventType.ROOM_MEMBER_UPDATED, state: updated.state }
      } as RoomEvent);
      return { state: updated.state };
    });
  };
}