export enum WSEventType {
  AUTH = 'auth',
  ERROR = 'error',
  PRESENCE = 'presence',
  PRESENCE_SYNC = 'presence_sync',
  TYPING = 'typing',
  CHAT = 'chat',
  CHANNEL_CREATED = 'channel_created',
  MEMBER_JOINED = 'member_joined',
}

export enum WSErrorCode {
  AUTHENTICATION_FAILED = 'auth_failed',
  INVALID_MESSAGE = 'invalid_message',
  RATE_LIMITED = 'rate_limited',
  PERMISSION_DENIED = 'permission_denied',
  INTERNAL_ERROR = 'internal_error',
}

export interface AuthMessage {
  type: WSEventType.AUTH;
  token: string;
}

export interface ErrorMessage {
  type: WSEventType.ERROR;
  code: WSErrorCode;
  message: string;
}

export interface PresenceMessage {
  type: WSEventType.PRESENCE;
  userId: number;
  status: 'online' | 'offline';
}

export interface PresenceSyncMessage {
  type: WSEventType.PRESENCE_SYNC;
  onlineUsers: number[];
}

export interface TypingMessage {
  type: WSEventType.TYPING;
  channelId: number;
  userId: number;
  isTyping: boolean;
}

export interface ChatMessage {
  type: WSEventType.CHAT;
  channelId: number;
  userId: number;
  content: string;
  messageId: number;
  createdAt: number;
  sender_name: string;
  avatar_url: string | null;
  threadId?: number;
}

export interface ChannelCreatedMessage {
  type: WSEventType.CHANNEL_CREATED;
  channelId: number;
  workspaceId: number;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdBy: number;
}

export interface MemberJoinedMessage {
  type: WSEventType.MEMBER_JOINED;
  channelId: number;
  userId: number;
  role: string;
}

export type WebSocketMessage =
  | AuthMessage
  | ErrorMessage
  | PresenceMessage
  | PresenceSyncMessage
  | TypingMessage
  | ChatMessage
  | ChannelCreatedMessage
  | MemberJoinedMessage;

// Type guards for runtime type checking
export const isAuthMessage = (msg: WebSocketMessage): msg is AuthMessage => 
  msg.type === WSEventType.AUTH;

export const isErrorMessage = (msg: WebSocketMessage): msg is ErrorMessage => 
  msg.type === WSEventType.ERROR;

export const isPresenceMessage = (msg: WebSocketMessage): msg is PresenceMessage => 
  msg.type === WSEventType.PRESENCE;

export const isPresenceSyncMessage = (msg: WebSocketMessage): msg is PresenceSyncMessage => 
  msg.type === WSEventType.PRESENCE_SYNC;

export const isTypingMessage = (msg: WebSocketMessage): msg is TypingMessage => 
  msg.type === WSEventType.TYPING;

export const isChatMessage = (msg: WebSocketMessage): msg is ChatMessage => 
  msg.type === WSEventType.CHAT;

export const isChannelCreatedMessage = (msg: WebSocketMessage): msg is ChannelCreatedMessage => 
  msg.type === WSEventType.CHANNEL_CREATED;

export const isMemberJoinedMessage = (msg: WebSocketMessage): msg is MemberJoinedMessage =>
  msg.type === WSEventType.MEMBER_JOINED;

// Message validation utilities
export const validateMessage = (msg: unknown): msg is WebSocketMessage => {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }

  const message = msg as Partial<WebSocketMessage>;
  
  switch (message.type) {
    case WSEventType.AUTH:
      return typeof message.token === 'string';
      
    case WSEventType.ERROR:
      return typeof message.code === 'string' && 
             typeof message.message === 'string';
      
    case WSEventType.PRESENCE:
      return typeof message.userId === 'number' && 
             (message.status === 'online' || message.status === 'offline');
      
    case WSEventType.PRESENCE_SYNC:
      return Array.isArray(message.onlineUsers) && 
             message.onlineUsers.every(id => typeof id === 'number');
      
    case WSEventType.TYPING:
      return typeof message.channelId === 'number' && 
             typeof message.userId === 'number' && 
             typeof message.isTyping === 'boolean';
      
    case WSEventType.CHAT:
      return typeof message.channelId === 'number' && 
             typeof message.userId === 'number' && 
             typeof message.content === 'string';
      
    case WSEventType.CHANNEL_CREATED:
      return typeof message.channelId === 'number' && 
             typeof message.workspaceId === 'number' && 
             typeof message.name === 'string' && 
             typeof message.isPrivate === 'boolean' && 
             typeof message.createdBy === 'number';

    case WSEventType.MEMBER_JOINED:
      return typeof message.channelId === 'number' &&
             typeof message.userId === 'number' &&
             typeof message.role === 'string';
      
    default:
      return false;
  }
}; 