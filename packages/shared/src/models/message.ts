import type { UnixTimestamp, ValidatedUnixTimestamp } from '@types'
import type { User } from '@models/user'
import type { Hub } from '@models/hub'
import type { Workspace } from '@models/workspace'
import type { BaseModel } from '@models/base'

/**
 * Core Message domain type with relationships
 */
export interface Message extends BaseModel {
  workspaceId: Workspace['id']
  hubId: Hub['id']
  content: string
  threadId?: Message['id']  // Self-referential for thread parent
  isEdited: boolean
  createdAt: ValidatedUnixTimestamp
  updatedAt: ValidatedUnixTimestamp
  deletedAt: ValidatedUnixTimestamp | null
  
  // Relationships
  sender: User
}

/**
 * API-specific Message type with additional metadata
 */
export interface ApiMessage extends Message {
  hub
?: Hub
  reactionCount: number
  replyCount: number
  hasThread: boolean
  attachments?: MessageAttachment[] // Full attachment metadata including URLs and types
}

/**
 * UI-specific Message type with client state
 */
export interface UiMessage extends ApiMessage {
  isSending?: boolean
  hasFailed?: boolean
  localId?: string
  optimistic?: boolean
  isHighlighted?: boolean
  isPending?: boolean
  isDeleting?: boolean
  showEditForm?: boolean
}

/**
 * Database row type - uses snake_case as per DB conventions
 */
export interface MessageRow {
  id: number
  workspace_id: Workspace['id']
  hub_id: Hub['id']
  sender_id: User['id']
  thread_id?: Message['id']
  content: string
  is_edited: boolean
  created_at: UnixTimestamp // Raw timestamp from DB
  updated_at: UnixTimestamp // Raw timestamp from DB
  deleted_at: UnixTimestamp | null // Raw timestamp from DB
  reaction_count: number
  reply_count: number
  has_thread: 0 | 1
  attachments?: string // JSON string in DB
}

/**
 * Message creation DTO - only includes fields that can be set on creation
 */
export type CreateMessageDTO = {
  workspaceId: Workspace['id']
  hubId: Hub['id']
  content: string
  senderId: User['id']
  threadId?: Message['id']
  fileIds?: number[] // IDs of already-uploaded files to attach
}

/**
 * Message update DTO - only includes fields that can be modified
 */
export type UpdateMessageDTO = {
  content?: string
  isEdited?: boolean
}

/**
 * Message reaction type
 */
export interface MessageReaction {
  id: number
  messageId: Message['id']
  userId: User['id']
  emoji: string
  createdAt: ValidatedUnixTimestamp
}

/**
 * Message attachment type
 */
export interface MessageAttachment {
  id: number
  messageId: Message['id']
  url: string
  type: 'image' | 'file'
  name: string
  size: number
  createdAt: ValidatedUnixTimestamp
}

/**
 * Message thread type
 */
export interface MessageThread {
  id: Message['id']  // Same as parent message ID
  lastReplyAt: ValidatedUnixTimestamp
  replyCount: number
  participantIds: User['id'][]
  isResolved?: boolean
}