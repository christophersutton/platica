import type { ServerWebSocket } from "bun";
import {
  WSEventType,
  type WebSocketEvent,
  type ChatEvent,
  type TypingEvent,
  type OutgoingChatEvent,
} from "@websockets";
import { DatabaseService } from "../db/core/database";
import type { UnixTimestamp } from "@types";
import { getCurrentUnixTimestamp } from "../utils/time";
import { validateTimestamp } from "@types";
import type { Message } from "@models/message";
import type { User } from "@models/user";

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

interface DBMessage {
  id: number;
  workspace_id: number;
  hub_id: number;
  sender_id: number;
  content: string;
  created_at: number;
  updated_at: number;
}

interface DBUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

type MessageHandler<T extends WebSocketEvent = WebSocketEvent> = (
  ws: ServerWebSocket<WebSocketData>,
  message: T
) => Promise<void>;

export class WebSocketService {
  private static instance: WebSocketService;
  private clients: Map<ServerWebSocket<WebSocketData>, Client> = new Map();
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private lastPresenceBroadcast: Map<string, number> = new Map();
  private messageHandlers: Map<WSEventType, MessageHandler> = new Map();

  private constructor() {
    // Clean up inactive clients periodically
    setInterval(() => this.cleanupInactiveClients(), 60000);

    // Initialize message handlers
    this.initializeMessageHandlers();
  }

  private initializeMessageHandlers() {
    this.messageHandlers.set(WSEventType.CHAT, (ws, message) =>
      this.handleChat(ws, message as OutgoingChatEvent)
    );
    this.messageHandlers.set(WSEventType.TYPING, (ws, message) =>
      this.handleTypingIndicator(ws, message as TypingEvent)
    );
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
      ws.close(1008, "Missing workspace_id or user_id");
      return;
    }

    this.clients.set(ws, {
      workspaceId,
      userId,
      lastActivity: getCurrentUnixTimestamp(),
    });

    // Broadcast initial presence state to the new client
    const onlineUsers = this.getOnlineUsersInWorkspace(workspaceId);
    ws.send(
      JSON.stringify({
        type: WSEventType.PRESENCE_SYNC,
        onlineUsers,
      })
    );

    // Then broadcast this user's presence to others, but only if we haven't recently
    const key = `${workspaceId}:${userId}`;
    const now = Date.now();
    const lastBroadcast = this.lastPresenceBroadcast.get(key) || 0;

    if (now - lastBroadcast > 5000) {
      // Only broadcast if more than 5 seconds since last broadcast
      this.lastPresenceBroadcast.set(key, now);
      this.broadcastPresence(workspaceId, userId, "online");
    }
  }

  public handleDisconnect(ws: ServerWebSocket<WebSocketData>) {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);

      // Check if this was the last connection for this user in this workspace
      let hasOtherConnections = false;
      for (const [_, otherClient] of this.clients.entries()) {
        if (
          otherClient.workspaceId === client.workspaceId &&
          otherClient.userId === client.userId
        ) {
          hasOtherConnections = true;
          break;
        }
      }

      // Only broadcast offline status if this was the last connection
      if (!hasOtherConnections) {
        this.broadcastPresence(client.workspaceId, client.userId, "offline");
      }
    }
  }

  public async handleMessage(
    ws: ServerWebSocket<WebSocketData>,
    rawMessage: string
  ) {
    try {
      const message = JSON.parse(rawMessage);

      // Validate message has a valid event type
      if (!message.type || !Object.values(WSEventType).includes(message.type)) {
        console.error("Invalid message type:", message);
        ws.send(
          JSON.stringify({
            type: WSEventType.ERROR,
            payload: {
              message: "Invalid message type",
            },
          })
        );
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
          ws.send(
            JSON.stringify({
              type: WSEventType.ERROR,
              payload: {
                message: "Internal server error",
              },
            })
          );
        }
      } else {
        console.warn("No handler for message type:", message.type);
        ws.send(
          JSON.stringify({
            type: WSEventType.ERROR,
            payload: {
              message: `Unsupported message type: ${message.type}`,
            },
          })
        );
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
      ws.send(
        JSON.stringify({
          type: WSEventType.ERROR,
          payload: {
            message: "Invalid message format",
          },
        })
      );
    }
  }

  private async handleChat(
    ws: ServerWebSocket<WebSocketData>,
    message: OutgoingChatEvent 
  ) {
    const client = this.clients.get(ws);
    if (!client) {
      throw new Error("Client not found");
    }

    // Handle both legacy format and new format
    console.log("Message:", message);
    const content = message.payload.content 

    if (!content?.trim()) {
      throw new Error("Message content cannot be empty");
    }

    // Get the database service
    const dbService = DatabaseService.getWriteInstance();

    // Save the message to the database
    const savedMessage = dbService.db
      .prepare(
        `
      INSERT INTO messages (workspace_id, hub_id, sender_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `
      )
      .get(
        client.workspaceId,
        message.payload.hubId,
        client.userId,
        content,
        getCurrentUnixTimestamp(),
        getCurrentUnixTimestamp()
      ) as DBMessage;

    // Get sender info
    const sender = dbService.db
      .prepare(
        `
      SELECT id, name, email, avatar_url, created_at, updated_at
      FROM users
      WHERE id = ?
    `
      )
      .get(client.userId) as DBUser;

    // Format as a proper ChatEvent with full message object
    const broadcastMessage: ChatEvent = {
      type: WSEventType.CHAT,
      payload: {
        message: {
          id: savedMessage.id,
          workspaceId: savedMessage.workspace_id,
          hubId: savedMessage.hub_id,
          content: savedMessage.content,
          createdAt: validateTimestamp(savedMessage.created_at),
          updatedAt: validateTimestamp(savedMessage.updated_at),
          deletedAt: null,
          threadId: undefined,

          sender: {
            id: sender.id,
            name: sender.name,
            email: sender.email,
            avatarUrl: sender.avatar_url,
            createdAt: validateTimestamp(sender.created_at),
            updatedAt: validateTimestamp(sender.updated_at),
            deletedAt: sender.deleted_at
              ? validateTimestamp(sender.deleted_at)
              : null,
          },

          isEdited: false,
        },
      },
    };

    // Broadcast to workspace
    this.broadcastToWorkspace(client.workspaceId, broadcastMessage);
  }

  public async handleTypingIndicator(
    ws: ServerWebSocket<WebSocketData>,
    message: TypingEvent
  ) {
    const client = this.clients.get(ws);
    if (!client) return;

    const key = `${client.workspaceId}:${client.userId}`;

    // Clear existing timeout
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key)!);
    }

    // Set timeout to clear typing status after 3 seconds
    this.typingTimeouts.set(
      key,
      setTimeout(() => {
        this.typingTimeouts.delete(key);
        // Broadcast typing stopped
        this.broadcastToWorkspace(client.workspaceId, {
          type: WSEventType.TYPING,
          payload: {
            hubId: message.payload.hubId,
            userId: client.userId,
            isTyping: false,
          },
        });
      }, 3000)
    );

    // Broadcast typing started
    this.broadcastToWorkspace(client.workspaceId, {
      type: WSEventType.TYPING,
      payload: {
        hubId: message.payload.hubId,
        userId: client.userId,
        isTyping: true,
      },
    });
  }

  public broadcastPresence(
    workspaceId: number,
    userId: number,
    status: "online" | "offline"
  ) {
    this.broadcastToWorkspace(workspaceId, {
      type: WSEventType.PRESENCE,
      payload: {
        userId,
        status,
      },
    });
  }

  public broadcastToWorkspace(workspaceId: number, message: WebSocketEvent) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.workspaceId === workspaceId) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  public broadcastToRoom(roomId: number, message: WebSocketEvent) {
    // Get all clients in the room's workspace and broadcast to them
    // This is a simplified version - in a real implementation we'd want to:
    // 1. Track room membership in the WebSocket service
    // 2. Only broadcast to clients that are members of the room
    // For now, we'll broadcast to the workspace since room events should be visible workspace-wide
    for (const [ws, client] of this.clients.entries()) {
      ws.send(JSON.stringify(message));
    }
  }

  private cleanupInactiveClients() {
    const now = getCurrentUnixTimestamp();
    for (const [ws, client] of this.clients.entries()) {
      if (now - client.lastActivity > 300) {
        // 5 minutes
        try {
          ws.close(1000, "Inactive");
        } catch (error) {
          console.error("Error closing inactive connection:", error);
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
