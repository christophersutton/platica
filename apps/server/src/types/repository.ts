import type { BaseModel, Hub, HubMember, Message, SoftDeletableModel, Workspace, WorkspaceMember } from '@models';
import type { User } from '@models';
import type { UserRole } from '@constants/enums';
import type { UnixTimestamp } from '@types';

/**
 * Repository-specific type extensions
 * These types extend the base shared types with additional metadata and relationships
 * needed for database operations and API responses.
 */

export interface MessageWithMeta extends Message {
  hub
?: Hub;
  user?: User;
  reactionCount: number;
  replyCount?: number;
  hasThread: 0 | 1;
  attachments?: string; // JSON string of attachments
}

export interface HubWithMeta extends Hub {
  workspace?: Workspace;
  members?: HubMemberWithUser[];
  messages?: Message[];
  member_count: number;
  message_count: number;
  last_message_at: number | null;
  has_unread?: boolean;
  member_status?: 'member' | 'invited' | null;
}

export interface HubMemberWithUser extends HubMember {
  user: User;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
  workspace_role: string;
}

export interface WorkspaceWithMeta extends Workspace {
  hubs?: Hub[];
  members?: WorkspaceMemberWithUser[];
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