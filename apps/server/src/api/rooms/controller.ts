import type { Context } from 'hono';
import { BaseController, ApiError } from '../base-controller';
import { RoomRepository } from '../../db/repositories/room-repository';
import type { DatabaseProvider } from '../../db/repositories/base';
import type { CreateRoomDTO, UpdateRoomDTO } from '@models/room';
import { WebSocketService } from '../../services/websockets';
import { WSEventType } from '@websockets';
import type { RoomEvent } from '@websockets';

interface CreateRoomBody {
  name: string;
  description?: string;
  scheduled_start: number;
  scheduled_end: number;
  settings?: {
    autoRecord?: boolean;
    retention?: {
      chatDays?: number;
      recordingDays?: number;
    };
    secretary?: {
      enabled: boolean;
      capabilities?: string[];
    };
  };
}

interface AddMemberBody {
  user_id: number;
  role?: 'host' | 'presenter' | 'participant';
}

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
      const body = await this.requireBody<CreateRoomBody>(c);

      const room = await this.roomRepo.create({
        workspaceId,
        name: body.name,
        description: body.description,
        scheduledStart: body.scheduled_start,
        scheduledEnd: body.scheduled_end,
        status: 'scheduled',
        createdBy: userId,
        settings: body.settings || {}
      } as CreateRoomDTO);

      // Add creator as host
      await this.roomRepo.addMember(room.id, userId, 'host');

      // Broadcast new room to workspace
      this.wsService.broadcastToWorkspace(workspaceId, {
        type: WSEventType.ROOM_CREATED,
        payload: { room }
      } as RoomEvent);

      return { room };
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
      const body = await this.requireBody<Partial<CreateRoomBody>>(c);

      // Check if user is host
      const role = await this.roomRepo.getMemberRole(roomId, userId);
      if (role !== 'host') {
        throw new ApiError('Only room host can update settings', 403);
      }

      const updateDto: UpdateRoomDTO = {
        name: body.name,
        description: body.description,
        scheduledEnd: body.scheduled_end,
        settings: body.settings
      };

      const room = await this.roomRepo.update(roomId, updateDto);
      if (!room) {
        throw new ApiError('Failed to update room', 500);
      }

      // Broadcast update
      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM_UPDATED,
        payload: { room }
      } as RoomEvent);

      return { room };
    });
  };

  joinRoom = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);

      // Add as participant by default
      await this.roomRepo.addMember(roomId, userId, 'participant');

      const room = await this.roomRepo.getRoomWithMeta(roomId, userId);
      const members = await this.roomRepo.getRoomMembers(roomId);

      // Broadcast join event
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

      // Broadcast leave event
      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM_MEMBER_LEFT,
        payload: { roomId, userId }
      } as RoomEvent);

      return { success: true };
    });
  };

  updateMemberState = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const roomId = this.requireNumberParam(c, 'roomId');
      const { userId } = this.requireUser(c);
      const body = await this.requireBody<UpdateMemberStateBody>(c);

      const updated = await this.roomRepo.updateMemberState(roomId, userId, body);
      if (!updated) {
        throw new ApiError('Member not found', 404);
      }

      // Broadcast state update
      this.wsService.broadcastToRoom(roomId, {
        type: WSEventType.ROOM_MEMBER_UPDATED,
        payload: { roomId, userId, state: updated.state }
      } as RoomEvent);

      return { state: updated.state };
    });
  };
}