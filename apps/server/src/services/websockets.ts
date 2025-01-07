import type { ServerWebSocket } from 'bun';
import type { UnixTimestamp } from '@platica/shared/types';
import { getCurrentUnixTimestamp } from '../utils/time';

interface WebSocketData {
  workspaceId: number;
  userId: number;
  authToken: string;
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

  private broadcastToWorkspace(workspaceId: number, data: any) {
    const message = JSON.stringify(data);
    for (const [ws, client] of this.clients.entries()) {
      if (client.workspaceId === workspaceId) {
        ws.send(message);
      }
    }
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