// Time types
export type UnixTimestamp = number; // Seconds since Unix epoch

// User and Authentication
export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

export interface WorkspaceUser {
  workspace_id: number;
  user_id: number;
  role: UserRole;
  display_name?: string;
  status?: UserStatus;
  status_message?: string;
  notification_preferences?: NotificationPreferences;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

// Workspace and Channels
export interface Workspace {
  id: number;
  name: string;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  file_size_limit?: number;
  default_message_retention_days?: number;
  notification_defaults?: NotificationPreferences;
}

export interface Channel {
  id: number;
  workspace_id: number;
  name: string;
  description?: string;
  is_private: boolean;
  is_archived: boolean;
  created_by: number;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

// Messages and Files
export interface Message {
  id: number;
  workspace_id: number;
  channel_id?: number;  // Optional for DMs
  sender_id: number;
  thread_id?: number;
  content: string;
  is_edited: boolean;
  edited_at?: UnixTimestamp;
  deleted_at?: UnixTimestamp;
  created_at: UnixTimestamp;
}

export interface File {
  id: number;
  workspace_id: number;
  uploader_id: number;
  message_id: number;
  name: string;
  size: number;
  mime_type: string;
  s3_key: string;
  created_at: UnixTimestamp;
}

// Enums
export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member'
}

export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  DND = 'dnd',
  OFFLINE = 'offline'
}

export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  SYSTEM = 'system'
}

export enum WSEventType {
  MESSAGE = 'message',
  TYPING = 'typing',
  PRESENCE = 'presence',
  REACTION = 'reaction'
}

// WebSocket Types
export interface WSMessage {
  type: WSEventType;
  workspace_id: number;
  channel_id?: number;
  user_id: number;
  data: any;
}

export interface TypingEvent {
  channel_id: number;
  user_id: number;
  is_typing: boolean;
}

export interface PresenceEvent {
  user_id: number;
  status: UserStatus;
  status_message?: string;
}

// Settings and Preferences
export interface NotificationPreferences {
  desktop_notifications: boolean;
  email_notifications: boolean;
  mobile_push: boolean;
  sound_enabled: boolean;
  muted_channels?: number[];
}