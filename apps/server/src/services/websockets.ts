import type { ServerWebSocket } from 'bun';
import type { UnixTimestamp } from '@platica/shared/types';
import { WSEventType, type WebSocketMessage, type ChatMessage, type TypingMessage, validateMessage } from '@platica/shared/src/websocket';
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

type MessageHandler<T extends WebSocketMessage = WebSocketMessage> = (ws: ServerWebSocket<WebSocketData>, message: T) => Promise<void>;

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
    this.messageHandlers.set(WSEventType.CHAT, (ws, message) => this.handleChat(ws, message as ChatMessage));
    this.messageHandlers.set(WSEventType.TYPING, (ws, message) => this.handleTypingIndicator(ws, message as TypingMessage));
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
      
      if (!validateMessage(message)) {
        console.error('Invalid message format:', message);
        ws.send(JSON.stringify({
          type: WSEventType.ERROR,
          message: 'Invalid message format'
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
            message: 'Internal server error'
          }));
        }
      } else {
        console.warn('No handler for message type:', message.type);
        ws.send(JSON.stringify({
          type: WSEventType.ERROR,
          message: `Unsupported message type: ${message.type}`
        }));
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
      ws.send(JSON.stringify({
        type: WSEventType.ERROR,
        message: 'Invalid message format'
      }));
    }
  }

  private async handleChat(ws: ServerWebSocket<WebSocketData>, message: ChatMessage) {
    const client = this.clients.get(ws);
    if (!client) {
      throw new Error('Client not found');
    }

    // Validate the message
    if (!message.content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    // Broadcast to workspace (use message as-is since it's already formatted)
    this.broadcastToWorkspace(client.workspaceId, message);
  }

  public async handleTypingIndicator(ws: ServerWebSocket<WebSocketData>, message: TypingMessage) {
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
        userId: client.userId,
        channelId: message.channelId,
        isTyping: false
      });
    }, 3000));

    // Broadcast typing started
    this.broadcastToWorkspace(client.workspaceId, {
      type: WSEventType.TYPING,
      userId: client.userId,
      channelId: message.channelId,
      isTyping: true
    });
  }

  public broadcastPresence(workspaceId: number, userId: number, status: 'online' | 'offline') {
    this.broadcastToWorkspace(workspaceId, {
      type: WSEventType.PRESENCE,
      userId,
      status
    });
  }

  public broadcastToWorkspace(workspaceId: number, message: WebSocketMessage) {
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

