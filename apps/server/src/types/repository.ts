import type { BaseModel, Channel, ChannelMember, Message, SoftDeletableModel, Workspace, WorkspaceMember } from '@models';
import type { User } from '@models';
import type { UserRole } from '@constants/enums';
import type { UnixTimestamp } from '@types';

/**
 * Repository-specific type extensions
 * These types extend the base shared types with additional metadata and relationships
 * needed for database operations and API responses.
 */

export interface MessageWithMeta extends Message {
  channel?: Channel;
  user?: User;
  sender_name: string;
  avatar_url: string | null;
  reaction_count: number;
  reply_count?: number;
  has_thread: 0 | 1;
  attachments?: string; // JSON string of attachments
}

export interface ChannelWithMeta extends Channel {
  workspace?: Workspace;
  members?: ChannelMemberWithUser[];
  messages?: Message[];
  member_count: number;
  message_count: number;
  last_message_at: number | null;
  has_unread?: boolean;
  member_status?: 'member' | 'invited' | null;
}

export interface ChannelMemberWithUser extends ChannelMember {
  user: User;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
  workspace_role: string;
}

export interface WorkspaceWithMeta extends Workspace {
  channels?: Channel[];
  members?: WorkspaceMemberWithUser[];
  member_count: number;
  channel_count: number;
  role?: UserRole;
}

export interface WorkspaceMemberWithUser extends WorkspaceMember {
  user: User;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
}

export interface WorkspaceInvite extends BaseModel {
  workspace_id: number;
  inviter_id: number;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'rejected';
  expires_at: UnixTimestamp;
  accepted_at?: UnixTimestamp;
  workspace?: Workspace;
} 