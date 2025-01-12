import type { Message } from "@models/message";
import type { User } from "@models/user";
import type { Hub } from "@models/hub";
import type { Room } from "@models/room";
import { isValidTimestamp } from "../utils/time";
import { TimestampError } from "../utils/time";

export type UserPresenceStatus = "online" | "offline" | "in_room";

export interface UserPresence {
  status: UserPresenceStatus;
  lastSeen: number;
  customStatus?: string;
  currentRoomId?: number;
}

export interface PresenceState {
  // Global presence map
  presenceMap: Record<User["id"], UserPresence>;
  // Connection state
  isConnected: boolean;
  lastUpdate: number;
}

export type PresenceAction =
  | {
      type: "SET_USER_STATUS";
      payload: { userId: number; status: UserPresenceStatus };
    }
  | { type: "SET_USER_ROOM"; payload: { userId: number; roomId?: number } }
  | { type: "SET_CUSTOM_STATUS"; payload: { userId: number; status?: string } }
  | { type: "SET_LAST_SEEN"; payload: { userId: number; timestamp: number } }
  | { type: "SET_CONNECTED"; payload: boolean }
  | {
      type: "SYNC_PRESENCE";
      payload: { userId: number; presence: UserPresence };
    }
  | { type: "BULK_SYNC_PRESENCE"; payload: Record<number, UserPresence> };
/**
 * Core WebSocket event types
 */
export enum WSEventType {
  AUTH = "auth",
  ERROR = "error",
  CHAT = "chat",
  TYPING = "typing",
  PRESENCE = "presence",
  PRESENCE_SYNC = "presence_sync",
  ROOM = "room",
  HUB = "hub",
}

export enum WSErrorCode {
  AUTHENTICATION_FAILED = "auth_failed",
  INVALID_MESSAGE = "invalid_message",
  RATE_LIMITED = "rate_limited",
  PERMISSION_DENIED = "permission_denied",
  INTERNAL_ERROR = "internal_error",
}

export enum RoomEventType {
  ROOM_CREATED = "room_created",
  ROOM_DETAILS = "room_details",
  ROOM_MEMBER_ADDED = "room_member_added",
  ROOM_MEMBER_REMOVED = "room_member_removed",
  ROOM_MEMBER_UPDATED = "room_member_updated",
}

export enum HubEventType {
  HUB_CREATED = "hub_created",
  HUB_MEMBER_ADDED = "hub_member_added",
  HUB_MEMBER_REMOVED = "hub_member_removed",
  HUB_MEMBER_UPDATED = "hub_member_updated",
}
/**
 * Message Events
 */
export interface ChatEvent {
  type: WSEventType.CHAT;
  payload: {
    message: Message; // Full message with relationships
  };
}

export interface OutgoingChatEvent {
  type: WSEventType.CHAT;
  payload: {
    workspaceId: number;
    hubId: number;
    content: string;
    senderId: number;
  };
}

/**
 * Typing Events
 */
export interface TypingEvent {
  type: WSEventType.TYPING;
  payload: {
    hubId: Hub["id"];
    userId: User["id"];
    isTyping: boolean;
  };
}

/**
 * Presence Events
 */
export interface PresenceEvent {
  type: WSEventType.PRESENCE;
  payload: {
    userId: User["id"];
    status: UserPresenceStatus;
    customStatus?: string;
  };
}

export interface PresenceSyncEvent {
  type: WSEventType.PRESENCE_SYNC;
  payload: {
    onlineUsers: User["id"][];
  };
}

/**
 * Hub Events
 */
export interface HubCreatedEvent {
  type: WSEventType.HUB;
  payload: {
    hub: Hub;
    hubEventType: HubEventType.HUB_CREATED;
  };
}

/**
 * Error Events
 */
export interface ErrorEvent {
  type: WSEventType.ERROR;
  payload: {
    code: WSErrorCode;
    message: string;
  };
}

/**
 * Auth Events
 */
export interface AuthEvent {
  type: WSEventType.AUTH;
  payload: {
    token: string;
  };
}

export interface HubMemberEvent {
  type: WSEventType.HUB;
  payload: {
    hubId: number;
    userId: number;
    role?: string;
    hubEventType: HubEventType;
  };
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
  | HubMemberEvent;

/**
 * Type guards for runtime type checking
 */
export const isAuthEvent = (event: WebSocketEvent): event is AuthEvent =>
  event.type === WSEventType.AUTH;

export const isErrorEvent = (event: WebSocketEvent): event is ErrorEvent =>
  event.type === WSEventType.ERROR;

export const isChatEvent = (event: WebSocketEvent): event is ChatEvent =>
  event.type === WSEventType.CHAT;

export const isTypingEvent = (event: WebSocketEvent): event is TypingEvent =>
  event.type === WSEventType.TYPING;

export const isPresenceEvent = (
  event: WebSocketEvent
): event is PresenceEvent => event.type === WSEventType.PRESENCE;

export const isPresenceSyncEvent = (
  event: WebSocketEvent
): event is PresenceSyncEvent => event.type === WSEventType.PRESENCE_SYNC;

export const isHubCreatedEvent = (
  event: WebSocketEvent
): event is HubCreatedEvent =>
  event.type === WSEventType.HUB && "hub" in event.payload;

export const isHubMemberEvent = (
  event: WebSocketEvent
): event is HubMemberEvent =>
  event.type === WSEventType.HUB && "hubEventType" in event.payload;

/**
 * Validates a WebSocket message has the correct structure
 */
export function validateMessage(data: unknown): data is WebSocketEvent {
  if (!data || typeof data !== "object") return false;

  // Check if data has type property
  if (!("type" in data)) return false;

  const event = data as Partial<WebSocketEvent>;
  const validTypes = Object.values(WSEventType);

  // Validate type is a known event type
  if (!validTypes.includes(event.type as WSEventType)) return false;

  // For all events, validate payload exists and is an object
  if (
    !("payload" in event) ||
    !event.payload ||
    typeof event.payload !== "object"
  )
    return false;

  // Additional validation for chat events containing messages
  if (
    event.type === WSEventType.CHAT &&
    "message" in event.payload &&
    event.payload.message
  ) {
    const message = event.payload.message as Partial<Message>;

    // Validate timestamps if present
    try {
      if ("createdAt" in message) {
        isValidTimestamp(message.createdAt as number);
      }
      if ("updatedAt" in message) {
        isValidTimestamp(message.updatedAt as number);
      }
      if ("deletedAt" in message && message.deletedAt !== null) {
        isValidTimestamp(message.deletedAt as number);
      }
    } catch (error) {
      if (error instanceof TimestampError) {
        console.error("Invalid timestamp in message:", error.message);
        return false;
      }
      throw error; // Re-throw unexpected errors
    }
  }

  return true;
}
