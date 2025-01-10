import type { UnixTimestamp } from '@types'
import type { UserRole, UserStatus } from '@constants/enums'
import type { BaseModel } from '@models/base'
import type { Workspace } from '@models/workspace'
import type { Channel } from '@models/channel'

/**
 * Core User domain type
 */
export interface User extends BaseModel {
  email: string
  name: string
  avatarUrl: string | null
  createdAt: UnixTimestamp
  updatedAt: UnixTimestamp
  deletedAt: UnixTimestamp | null
}

/**
 * API-specific User type with additional metadata
 */
export interface ApiUser extends User {
  workspaces?: ApiWorkspaceUser[]
}

/**
 * UI-specific User type with client state
 */
export interface UiUser extends ApiUser {
  presence?: UserStatus
  lastSeen?: UnixTimestamp
  isTyping?: boolean
}

/**
 * User preferences
 */
export interface NotificationPreferences {
  desktopNotifications: boolean
  emailNotifications: boolean
  mobilePush: boolean
  soundEnabled: boolean
  mutedChannels?: Channel['id'][]
}

/**
 * API-specific Workspace User type
 */
export interface ApiWorkspaceUser extends User {
  workspaceId: Workspace['id']
  role: UserRole
  displayName?: string
  status?: UserStatus
  statusMessage?: string
  notificationPreferences?: NotificationPreferences
}

/**
 * Database row type
 */
export interface UserRow {
  id: number
  email: string
  name: string
  avatar_url: string | null
  created_at: UnixTimestamp
  updated_at: UnixTimestamp
  deleted_at: UnixTimestamp | null
}

/**
 * Database row for workspace user
 */
export interface WorkspaceUserRow {
  workspace_id: Workspace['id']
  user_id: User['id']
  role: UserRole
  display_name?: string
  status?: UserStatus
  status_message?: string
  notification_preferences?: NotificationPreferences
  created_at: UnixTimestamp
  updated_at: UnixTimestamp
  deleted_at: UnixTimestamp | null
}

/**
 * Required fields when creating a user
 */
type UserRequiredFields = 'email' | 'name'

/**
 * Optional fields when creating a user
 */
type UserOptionalFields = 'avatarUrl'

/**
 * User creation DTO
 */
export type CreateUserDTO = Pick<User, UserRequiredFields | UserOptionalFields>

/**
 * User update DTO
 */
export type UpdateUserDTO = Partial<Pick<User, UserOptionalFields | 'name'>>

/**
 * Required fields when creating a workspace user
 */
type WorkspaceUserRequiredFields = 'workspaceId' | 'role'

/**
 * Optional fields when creating a workspace user
 */
type WorkspaceUserOptionalFields = 'displayName' | 'status' | 'statusMessage' | 'notificationPreferences'

/**
 * Workspace user creation DTO
 */
export type CreateWorkspaceUserDTO = Pick<ApiWorkspaceUser, WorkspaceUserRequiredFields | WorkspaceUserOptionalFields>