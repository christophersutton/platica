import type { UnixTimestamp } from "@types";
import type { User } from "@models/user";
import type { Workspace } from "@models/workspace";
import type { BaseModel } from "@models/base";
import type { Message } from "@models/message";

/**
 * Core Hub domain type
 */
export interface Hub extends BaseModel {
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
 * Hub member role type
 */
export type HubMemberRole = "owner" | "admin" | "member";

/**
 * Hub member relationship
 */
export interface HubMember extends BaseModel {
  hubId: Hub["id"];
  userId: User["id"];
  role: HubMemberRole;
  lastReadAt: UnixTimestamp;
  settings: Record<string, unknown>;
}

/**
 * API-specific Hub type with additional metadata
 */
export interface ApiHub extends Hub {
  workspace?: Workspace;
  memberCount: number;
  messageCount: number;
  lastMessageAt: UnixTimestamp | null;
  members?: ApiHubMember[];
  messages?: Message[];
}

/**
 * API-specific Hub Member type with user data
 */
export interface ApiHubMember extends HubMember {
  user: User;
  workspaceRole: string;
}

/**
 * UI-specific Hub type with client state
 */
export interface UiHub extends ApiHub {
  unreadCount?: number;
  unreadMentions?: number;
  memberStatus?: "member" | "invited" | null;
}

/**
 * Database row type
 */
export interface HubRow {
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
 * Database row for hub
 member
 */
export interface HubMemberRow {
  id: number;
  hub_id: Hub["id"];
  user_id: User["id"];
  role: HubMemberRole;
  last_read_at: UnixTimestamp;
  settings: Record<string, unknown>;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}

/**
 * Required fields when creating a hub

 */
type HubRequiredFields = "workspaceId" | "name";

/**
 * Optional fields when creating a hub

 */
type HubOptionalFields = "description" | "topic" | "settings";

/**
 * Hub creation DTO - only includes fields that can be set on creation
 */
export type CreateHubDTO = Pick<
  Hub,
  HubRequiredFields | HubOptionalFields
>;

/**
 * Hub update DTO - only includes fields that can be modified
 */
export type UpdateHubDTO = Partial<
  Pick<Hub, "name" | "description" | "topic" | "isArchived" | "settings">
>;
