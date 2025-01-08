import type { ServerWebSocket } from 'bun';
import type { UnixTimestamp } from '@platica/shared/types';
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

export class WebSocketService {
  private static instance: WebSocketService;
  private clients: Map<ServerWebSocket<WebSocketData>, Client> = new Map();
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastPresenceBroadcast: Map<string, number> = new Map();

  private constructor() {
    // Clean up inactive clients periodically
    setInterval(() => this.cleanupInactiveClients(), 60000);
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
      type: 'presence_sync',
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

  public handleTypingIndicator(workspaceId: number, userId: number) {
    const key = `${workspaceId}:${userId}`;
    
    // Clear existing timeout
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key)!);
    }

    // Set timeout to clear typing status after 3 seconds
    this.typingTimeouts.set(key, setTimeout(() => {
      this.typingTimeouts.delete(key);
    }, 3000));
  }

  public broadcastPresence(workspaceId: number, userId: number, status: 'online' | 'offline') {
    this.broadcastToWorkspace(workspaceId, {
      type: 'presence',
      userId,
      status
    });
  }

  public broadcastToWorkspace(workspaceId: number, data: any) {
    console.log('[WebSocketService] Broadcasting to workspace:', {
      workspaceId,
      messageData: data,
      propertyTypes: Object.entries(data).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: typeof value
      }), {})
    });

    const message = JSON.stringify(data);
    console.log('[WebSocketService] Stringified message:', message);

    let clientCount = 0;
    for (const [ws, client] of this.clients.entries()) {
      if (client.workspaceId === workspaceId) {
        clientCount++;
        ws.send(message);
      }
    }
    console.log(`[WebSocketService] Message sent to ${clientCount} clients`);
  }

  private cleanupInactiveClients() {
    const now = getCurrentUnixTimestamp();
    for (const [ws, client] of this.clients.entries()) {
      if (now - client.lastActivity > 300) { // 5 minutes
        ws.close(1000, 'Inactive');
        this.clients.delete(ws);
      }
    }
  }
}