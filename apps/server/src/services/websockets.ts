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
  private clients: Map<ServerWebSocket<WebSocketData>, Client> = new Map();
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    // Clean up inactive clients periodically
    setInterval(() => this.cleanupInactiveClients(), 60000);
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
  }

  public handleDisconnect(ws: ServerWebSocket<WebSocketData>) {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
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