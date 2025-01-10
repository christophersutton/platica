import type { UnixTimestamp } from "@types";
import type { User } from "@models/user";
import type { Workspace } from "@models/workspace";
import type { BaseModel } from "@models/base";
import type { Message } from "@models/message";

/**
 * Core Channel domain type
 */
export interface Channel extends BaseModel {
  workspaceId: Workspace["id"];
  name: string;
  description?: string;
  topic?: string | null;
  isArchived: boolean;
  createdBy: User["id"];

  deletedAt: UnixTimestamp | null;
  settings?: Record<string, unknown>;
}

/**
 * Channel member role type
 */
export type ChannelMemberRole = "owner" | "admin" | "member";

/**
 * Channel member relationship
 */
export interface ChannelMember extends BaseModel {
  channelId: Channel["id"];
  userId: User["id"];
  role: ChannelMemberRole;
  lastReadAt: UnixTimestamp;
  settings: Record<string, unknown>;
}

/**
 * API-specific Channel type with additional metadata
 */
export interface ApiChannel extends Channel {
  workspace?: Workspace;
  memberCount: number;
  messageCount: number;
  lastMessageAt: UnixTimestamp | null;
  members?: ApiChannelMember[];
  messages?: Message[];
}

/**
 * API-specific Channel Member type with user data
 */
export interface ApiChannelMember extends ChannelMember {
  user: User;
  workspaceRole: string;
}

/**
 * UI-specific Channel type with client state
 */
export interface UiChannel extends ApiChannel {
  unreadCount?: number;
  unreadMentions?: number;
  memberStatus?: "member" | "invited" | null;
}

/**
 * Database row type
 */
export interface ChannelRow {
  id: number;
  workspace_id: Workspace["id"];
  name: string;
  description?: string;
  topic?: string | null;
  is_archived: boolean;
  created_by: User["id"];
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
  settings?: Record<string, unknown>;
  member_count: number;
  message_count: number;
  last_message_at: UnixTimestamp | null;
}

/**
 * Database row for channel member
 */
export interface ChannelMemberRow {
  id: number;
  channel_id: Channel["id"];
  user_id: User["id"];
  role: ChannelMemberRole;
  last_read_at: UnixTimestamp;
  settings: Record<string, unknown>;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}

/**
 * Required fields when creating a channel
 */
type ChannelRequiredFields = "workspaceId" | "name";

/**
 * Optional fields when creating a channel
 */
type ChannelOptionalFields = "description" | "topic" | "settings";

/**
 * Channel creation DTO - only includes fields that can be set on creation
 */
export type CreateChannelDTO = Pick<
  Channel,
  ChannelRequiredFields | ChannelOptionalFields
>;

/**
 * Channel update DTO - only includes fields that can be modified
 */
export type UpdateChannelDTO = Partial<
  Pick<Channel, "name" | "description" | "topic" | "isArchived" | "settings">
>;
