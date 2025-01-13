/*
  File: room.ts

  Updated references so the DB and domain align with Zod "RoomSchema".
  Also ensure we match the new "status" property, "isArchived" if needed,
  and any new fields from the Zod schema. 
*/

import type { UnixTimestamp } from '@types';
import type { User } from '@models/user';
import type { Workspace } from '@models/workspace';
import type { BaseModel, SoftDeletableModel } from '@models/base';

/**
 * Room status type
 */
export type RoomStatus = 'scheduled' | 'active' | 'ended';

/**
 * Room member role type
 */
export type RoomMemberRole = 'host' | 'presenter' | 'participant';

/**
 * Room settings interface
 */
export interface RoomSettings {
  autoRecord?: boolean;
  retention?: {
    chatDays?: number;
    recordingDays?: number;
  };
  secretary?: {
    enabled: boolean;
    capabilities?: string[];
  };
}

/**
 * Core Room domain type
 */
export interface Room extends SoftDeletableModel {
  workspaceId: Workspace['id'];
  name: string;
  description?: string;
  scheduledStart: UnixTimestamp;
  scheduledEnd: UnixTimestamp;
  startedAt?: UnixTimestamp;
  endedAt?: UnixTimestamp;
  status: RoomStatus;
  createdBy: User['id'];
  settings: RoomSettings;
}

/**
 * Room member state type
 */
export interface RoomMemberState {
  online: boolean;
  audio: boolean;
  video: boolean;
  sharing: boolean;
  handRaised: boolean;
}

/**
 * Room member relationship
 */
export interface RoomMember extends BaseModel {
  roomId: Room['id'];
  userId: User['id'];
  role: RoomMemberRole;
  joinedAt: UnixTimestamp;
  leftAt?: UnixTimestamp;
  state: RoomMemberState;
}

/**
 * API-specific Room type with additional metadata
 */
export interface ApiRoom extends Room {
  workspace?: Workspace;
  currentMembers: number;
  totalJoined: number;
  members?: ApiRoomMember[];
}

/**
 * API-specific Room Member type with user data
 */
export interface ApiRoomMember extends RoomMember {
  user: User;
}

/**
 * UI-specific Room type with client state
 */
export interface UiRoom extends ApiRoom {
  hasUnreadMessages?: boolean;
  memberStatus?: 'host' | 'member' | null;
}

/**
 * Database row type
 */
export interface RoomRow {
  id: number;
  workspace_id: Workspace['id'];
  name: string;
  description?: string;
  scheduled_start: UnixTimestamp;
  scheduled_end: UnixTimestamp;
  started_at?: UnixTimestamp;
  ended_at?: UnixTimestamp;
  status: RoomStatus;
  created_by: User['id'];
  settings: RoomSettings;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}

/**
 * Database row for room member
 */
export interface RoomMemberRow {
  id: number;
  room_id: Room['id'];
  user_id: User['id'];
  role: RoomMemberRole;
  joined_at: UnixTimestamp;
  left_at?: UnixTimestamp;
  state: RoomMemberState;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}

/**
 * Required fields when creating a room
 */
type RoomRequiredFields = 'workspaceId' | 'name' | 'scheduledStart' | 'scheduledEnd' | 'status' | 'createdBy';

/**
 * Optional fields when creating a room
 */
type RoomOptionalFields = 'description' | 'settings';

/**
 * Room creation DTO
 */
export type CreateRoomDTO = Pick<Room, RoomRequiredFields | RoomOptionalFields>;

/**
 * Room update DTO
 */
export type UpdateRoomDTO = Partial<Pick<Room, 'name' | 'description' | 'scheduledEnd' | 'settings'>>;