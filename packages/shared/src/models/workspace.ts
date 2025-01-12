import type { UnixTimestamp } from '@types';
import type { BaseModel } from '@models/base';
import type { NotificationPreferences, User } from '@models/user';
import type { Hub } from '@models/hub';

/**
 * Core Workspace domain type
 */
export interface Workspace extends BaseModel {
    name: string;
    slug: string;
    ownerId: User['id'];
    fileSizeLimit?: number;
    defaultMessageRetentionDays?: number;
    notificationDefaults?: NotificationPreferences;
    settings: Record<string, unknown>;
}

/**
 * Workspace member role type
 */
export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'guest';

/**
 * Workspace member relationship
 */
export interface WorkspaceMember extends BaseModel {
    workspaceId: Workspace['id'];
    userId: User['id'];
    role: WorkspaceMemberRole;
    settings: Record<string, unknown>;
}

/**
 * API-specific Workspace type with additional metadata
 */
export interface ApiWorkspace extends Workspace {
    memberCount: number;
    hubCount: number;
    role: WorkspaceMemberRole;
    iconUrl: string | null;
    members?: ApiWorkspaceMember[];
    hubs?: Hub[];
}

/**
 * API-specific Workspace Member type with user data
 */
export interface ApiWorkspaceMember extends WorkspaceMember {
    user: User;
}

/**
 * UI-specific Workspace type with client state
 */
export interface UiWorkspace extends ApiWorkspace {
    unreadCount?: number;
    mentionCount?: number;
}

/**
 * Database row type
 */
export interface WorkspaceRow {
    id: number;
    name: string;
    slug: string;
    owner_id: User['id'];
    file_size_limit?: number;
    default_message_retention_days?: number;
    notification_defaults?: NotificationPreferences;
    settings: Record<string, unknown>;
    member_count: number;
    hub_count: number;
    icon_url: string | null;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
}

/**
 * Database row for workspace member
 */
export interface WorkspaceMemberRow {
    id: number;
    workspace_id: Workspace['id'];
    user_id: User['id'];
    role: WorkspaceMemberRole;
    settings: Record<string, unknown>;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
}

/**
 * Required fields when creating a workspace
 */
type WorkspaceRequiredFields = 'name' | 'slug' | 'ownerId' | 'settings';

/**
 * Optional fields when creating a workspace
 */
type WorkspaceOptionalFields = 'fileSizeLimit' | 'defaultMessageRetentionDays' | 'notificationDefaults';

/**
 * Workspace creation DTO - only includes fields that can be set on creation
 */
export type CreateWorkspaceDTO = Pick<Workspace, WorkspaceRequiredFields | WorkspaceOptionalFields>;

/**
 * Fields that cannot be updated
 */
type WorkspaceImmutableFields = keyof BaseModel | 'slug' | 'ownerId';

/**
 * Workspace update DTO - only includes fields that can be modified
 */
export type UpdateWorkspaceDTO = Partial<Omit<Workspace, WorkspaceImmutableFields>>;