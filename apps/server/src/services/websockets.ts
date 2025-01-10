import type { ServerWebSocket } from 'bun';
import { 
  WSEventType, 
  type WebSocketEvent,
  type ChatEvent,
  type TypingEvent,
  type PresenceEvent,
  type PresenceSyncEvent,
  isAuthEvent,
  isChatEvent,
  isTypingEvent,
  isPresenceEvent,
  isPresenceSyncEvent
} from '@websockets';
import { DatabaseService } from '../db/core/database';
import type { UnixTimestamp } from '@types';
import { getCurrentUnixTimestamp } from '../utils/time';

interface WebSocketData {
  workspaceId: number;
  userId: number;
  isAuthenticated: boolean;
}

interface Client {
  workspaceId: number;
  userId: number;
  lastActivity: UnixTimestamp;
}

type MessageHandler<T extends WebSocketEvent = WebSocketEvent> = (ws: ServerWebSocket<WebSocketData>, message: T) => Promise<void>;

export class WebSocketService {
  private static instance: WebSocketService;
  private clients: Map<ServerWebSocket<WebSocketData>, Client> = new Map();
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastPresenceBroadcast: Map<string, number> = new Map();
  private messageHandlers: Map<WSEventType, MessageHandler> = new Map();

  private constructor() {
    // Clean up inactive clients periodically
    setInterval(() => this.cleanupInactiveClients(), 60000);
    
    // Initialize message handlers
    this.initializeMessageHandlers();
  }

  private initializeMessageHandlers() {
    this.messageHandlers.set(WSEventType.CHAT, (ws, message) => this.handleChat(ws, message as ChatEvent));
    this.messageHandlers.set(WSEventType.TYPING, (ws, message) => this.handleTypingIndicator(ws, message as TypingEvent));
    // Add more handlers as needed
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private getOnlineUsersInWorkspace(workspaceId: number): number[] {
    const onlineUsers = new Set<number>();
    for (const [_, client] of this.clients.entries()) {
      if (client.workspaceId === workspaceId) {
        onlineUsers.add(client.userId);
      }
    }
    return Array.from(onlineUsers);
  }

  public handleConnect(ws: ServerWebSocket<WebSocketData>) {
    const { workspaceId, userId } = ws.data;

    if (!workspaceId || !userId) {
      ws.close(1008, 'Missing workspace_id or user_id');
      return;
    }

    this.clients.set(ws, {
      workspaceId,
      userId,
      lastActivity: getCurrentUnixTimestamp()
    });

    // Broadcast initial presence state to the new client
    const onlineUsers = this.getOnlineUsersInWorkspace(workspaceId);
    ws.send(JSON.stringify({
      type: WSEventType.PRESENCE_SYNC,
      onlineUsers
    }));

    // Then broadcast this user's presence to others, but only if we haven't recently
    const key = `${workspaceId}:${userId}`;
    const now = Date.now();
    const lastBroadcast = this.lastPresenceBroadcast.get(key) || 0;
    
    if (now - lastBroadcast > 5000) { // Only broadcast if more than 5 seconds since last broadcast
      this.lastPresenceBroadcast.set(key, now);
      this.broadcastPresence(workspaceId, userId, 'online');
    }
  }

  public handleDisconnect(ws: ServerWebSocket<WebSocketData>) {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
      
      // Check if this was the last connection for this user in this workspace
      let hasOtherConnections = false;
      for (const [_, otherClient] of this.clients.entries()) {
        if (otherClient.workspaceId === client.workspaceId && 
            otherClient.userId === client.userId) {
          hasOtherConnections = true;
          break;
        }
      }
      
      // Only broadcast offline status if this was the last connection
      if (!hasOtherConnections) {
        this.broadcastPresence(client.workspaceId, client.userId, 'offline');
      }
    }
  }

  public async handleMessage(ws: ServerWebSocket<WebSocketData>, rawMessage: string) {
    try {
      const message = JSON.parse(rawMessage);
      
      // Validate message has a valid event type
      if (!message.type || !Object.values(WSEventType).includes(message.type)) {
        console.error('Invalid message type:', message);
        ws.send(JSON.stringify({
          type: WSEventType.ERROR,
          payload: {
            message: 'Invalid message type'
          }
        }));
        return;
      }

      // Update last activity
      this.updateLastActivity(ws);

      // Get the appropriate handler for this message type
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        try {
          await handler(ws, message);
        } catch (error) {
          console.error(`Error handling message type ${message.type}:`, error);
          ws.send(JSON.stringify({
            type: WSEventType.ERROR,
            payload: {
              message: 'Internal server error'
            }
          }));
        }
      } else {
        console.warn('No handler for message type:', message.type);
        ws.send(JSON.stringify({
          type: WSEventType.ERROR,
          payload: {
            message: `Unsupported message type: ${message.type}`
          }
        }));
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
      ws.send(JSON.stringify({
        type: WSEventType.ERROR,
        payload: {
          message: 'Invalid message format'
        }
      }));
    }
  }

  private async handleChat(ws: ServerWebSocket<WebSocketData>, message: ChatEvent) {
    const client = this.clients.get(ws);
    if (!client) {
      throw new Error('Client not found');
    }

    // Validate the message
    if (!message.payload.message.content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    // Broadcast to workspace (use message as-is since it's already formatted)
    this.broadcastToWorkspace(client.workspaceId, message);
  }

  public async handleTypingIndicator(ws: ServerWebSocket<WebSocketData>, message: TypingEvent) {
    const client = this.clients.get(ws);
    if (!client) return;

    const key = `${client.workspaceId}:${client.userId}`;
    
    // Clear existing timeout
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key)!);
    }

    // Set timeout to clear typing status after 3 seconds
    this.typingTimeouts.set(key, setTimeout(() => {
      this.typingTimeouts.delete(key);
      // Broadcast typing stopped
      this.broadcastToWorkspace(client.workspaceId, {
        type: WSEventType.TYPING,
        payload: {
          channelId: message.payload.channelId,
          userId: client.userId,
          isTyping: false
        }
      });
    }, 3000));

    // Broadcast typing started
    this.broadcastToWorkspace(client.workspaceId, {
      type: WSEventType.TYPING,
      payload: {
        channelId: message.payload.channelId,
        userId: client.userId,
        isTyping: true
      }
    });
  }

  public broadcastPresence(workspaceId: number, userId: number, status: 'online' | 'offline') {
    this.broadcastToWorkspace(workspaceId, {
      type: WSEventType.PRESENCE,
      payload: {
        userId,
        status
      }
    });
  }

  public broadcastToWorkspace(workspaceId: number, message: WebSocketEvent) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.workspaceId === workspaceId) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  private cleanupInactiveClients() {
    const now = getCurrentUnixTimestamp();
    for (const [ws, client] of this.clients.entries()) {
      if (now - client.lastActivity > 300) { // 5 minutes
        try {
          ws.close(1000, 'Inactive');
        } catch (error) {
          console.error('Error closing inactive connection:', error);
        }
        this.clients.delete(ws);
      }
    }
  }

  private updateLastActivity(ws: ServerWebSocket<WebSocketData>) {
    const client = this.clients.get(ws);
    if (client) {
      client.lastActivity = getCurrentUnixTimestamp();
    }
  }
}

