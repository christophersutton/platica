import type { Message, CreateMessageDTO } from '@models/message'
import type { User } from '@models/user'
import type { Hub } from '@models/hub
'
import { validateTimestamp } from '@types'
import { TimestampError } from '../utils/time'

export type UserPresenceStatus = 'online' | 'offline' | 'in_room'

/**
 * Core WebSocket event types
 */
export enum WSEventType {
  AUTH = 'auth',
  ERROR = 'error',
  CHAT = 'chat',
  TYPING = 'typing',
  PRESENCE = 'presence',
  PRESENCE_SYNC = 'presence_sync',
  CHANNEL_CREATED = 'hub_created',
  CHANNEL_MEMBER_ADDED = 'hub_member_added',
  CHANNEL_MEMBER_REMOVED = 'hub_member_removed',
  CHANNEL_MEMBER_UPDATED = 'hub_member_updated'
}

export enum WSErrorCode {
  AUTHENTICATION_FAILED = 'auth_failed',
  INVALID_MESSAGE = 'invalid_message',
  RATE_LIMITED = 'rate_limited',
  PERMISSION_DENIED = 'permission_denied',
  INTERNAL_ERROR = 'internal_error',
}

/**
 * Message Events
 */
export interface ChatEvent {
  type: WSEventType.CHAT
  payload: {
    message: Message  // Full message with relationships
  }
}

export interface OutgoingChatEvent {
  type: WSEventType.CHAT
  payload: {
    workspaceId: number
    hubId: number
    content: string
    senderId: number
  }
}

/**
 * Typing Events
 */
export interface TypingEvent {
  type: WSEventType.TYPING
  payload: {
    hubId: Hub['id']
    userId: User['id']
    isTyping: boolean
  }
}

/**
 * Presence Events
 */
export interface PresenceEvent {
  type: WSEventType.PRESENCE
  payload: {
    userId: User['id']
    status: UserPresenceStatus
    customStatus?: string
  }
}

export interface PresenceSyncEvent {
  type: WSEventType.PRESENCE_SYNC
  payload: {
    onlineUsers: User['id'][]
  }
}

/**
 * Hub Events
 */
export interface HubCreatedEvent {
  type: WSEventType.CHANNEL_CREATED
  payload: {
    hub
: Hub
  }
}

/**
 * Error Events
 */
export interface ErrorEvent {
  type: WSEventType.ERROR
  payload: {
    code: WSErrorCode
    message: string
  }
}

/**
 * Auth Events
 */
export interface AuthEvent {
  type: WSEventType.AUTH
  payload: {
    token: string
  }
}

export interface HubMemberEvent {
  type: WSEventType.CHANNEL_MEMBER_ADDED | WSEventType.CHANNEL_MEMBER_REMOVED | WSEventType.CHANNEL_MEMBER_UPDATED;
  hubId: number;
  userId: number;
  role?: string;
}

/**
 * Union type of all possible WebSocket events
 */
export type WebSocketEvent =
  | ChatEvent
  | OutgoingChatEvent
  | TypingEvent
  | PresenceEvent
  | PresenceSyncEvent
  | HubCreatedEvent
  | ErrorEvent
  | AuthEvent
  | HubMemberEvent

/**
 * Type guards for runtime type checking
 */
export const isAuthEvent = (event: WebSocketEvent): event is AuthEvent => 
  event.type === WSEventType.AUTH

export const isErrorEvent = (event: WebSocketEvent): event is ErrorEvent => 
  event.type === WSEventType.ERROR

export const isChatEvent = (event: WebSocketEvent): event is ChatEvent => 
  event.type === WSEventType.CHAT

export const isTypingEvent = (event: WebSocketEvent): event is TypingEvent => 
  event.type === WSEventType.TYPING

export const isPresenceEvent = (event: WebSocketEvent): event is PresenceEvent => 
  event.type === WSEventType.PRESENCE

export const isPresenceSyncEvent = (event: WebSocketEvent): event is PresenceSyncEvent => 
  event.type === WSEventType.PRESENCE_SYNC

export const isHubCreatedEvent = (event: WebSocketEvent): event is HubCreatedEvent => 
  event.type === WSEventType.CHANNEL_CREATED 

/**
 * Validates a WebSocket message has the correct structure
 */
export function validateMessage(data: unknown): data is WebSocketEvent {
  if (!data || typeof data !== 'object') return false
  
  // Check if data has type property
  if (!('type' in data)) return false
  
  const event = data as Partial<WebSocketEvent>
  const validTypes = Object.values(WSEventType)
  
  // Validate type is a known event type
  if (!validTypes.includes(event.type as WSEventType)) return false
  
  // Handle hub
 member events differently as they don't have a payload property
  if (event.type === WSEventType.CHANNEL_MEMBER_ADDED || 
      event.type === WSEventType.CHANNEL_MEMBER_REMOVED || 
      event.type === WSEventType.CHANNEL_MEMBER_UPDATED) {
    return true
  }

  // For all other events, validate payload exists and is an object
  if (!('payload' in event) || !event.payload || typeof event.payload !== 'object') return false

  // Additional validation for chat events containing messages
  if (event.type === WSEventType.CHAT && 
      'message' in event.payload && 
      event.payload.message) {
    const message = event.payload.message as Partial<Message>
    
    // Validate timestamps if present
    try {
      if ('createdAt' in message) {
        message.createdAt = validateTimestamp(message.createdAt as number);
      }
      if ('updatedAt' in message) {
        message.updatedAt = validateTimestamp(message.updatedAt as number);
      }
      if ('deletedAt' in message && message.deletedAt !== null) {
        message.deletedAt = validateTimestamp(message.deletedAt as number);
      }
    } catch (error) {
      if (error instanceof TimestampError) {
        console.error('Invalid timestamp in message:', error.message);
        return false;
      }
      throw error; // Re-throw unexpected errors
    }
  }
  
  return true
} 