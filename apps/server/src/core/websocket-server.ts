import { verify } from "hono/jwt";
import { DatabaseService } from "../db/core/database";
import { WebSocketService } from "../services/websockets";
import { WebSocketRateLimiter } from "../middleware/websocket-rate-limiter";
import { WSEventType, type OutgoingChatEvent } from "@websockets";
import WriteService from "../services/write";

// Import repositories
import { WorkspaceRepository } from "../db/repositories/workspace-repository";
import { UserRepository } from "../db/repositories/user-repository";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Initialize singletons
const dbService = DatabaseService.getWriteInstance();
const workspaceRepo = new WorkspaceRepository(dbService.db);
const userRepo = new UserRepository(dbService.db);
const wsService = WebSocketService.getInstance();
const writeService = new WriteService(wsService);
const rateLimiter = new WebSocketRateLimiter();

// Periodically clean up rate limiters
setInterval(() => rateLimiter.cleanup(), 60000);

interface WebSocketData {
  workspaceId: number;
  userId: number;
  isAuthenticated: boolean;
}

interface AuthMessage {
  type: "auth";
  token: string;
}

export function startWebSocketServer(port: number) {
  const server = Bun.serve<WebSocketData>({
    port,
    async fetch(req, server) {
      try {
        const url = new URL(req.url);
        const workspaceId = Number(url.searchParams.get("workspace_id"));
        const userId = Number(url.searchParams.get("user_id"));

        if (isNaN(workspaceId) || isNaN(userId)) {
          return new Response("Invalid workspace_id or user_id", { status: 400 });
        }

        const success = server.upgrade(req, {
          data: {
            workspaceId,
            userId,
            isAuthenticated: false,
          },
        });

        return success
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 400 });
      } catch (error) {
        console.error("WebSocket connection error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    websocket: {
      async message(ws, message) {
        try {
          const data = JSON.parse(String(message));

          // Handle authentication
          if (data.type === "auth") {
            const authMessage = data.payload as AuthMessage;
            if (!authMessage.token?.startsWith("Bearer ")) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid token format" }));
              ws.close(1008, "Invalid token format");
              return;
            }
            const token = authMessage.token.split(" ")[1];

            try {
              const payload = await verify(token, JWT_SECRET);
              if (!payload || typeof payload.id !== "number" || payload.id !== ws.data.userId) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
                ws.close(1008, "Invalid token");
                return;
              }

              // Check workspace membership using repository
              const workspace = await workspaceRepo.findById(ws.data.workspaceId);
              if (!workspace) {
                ws.send(JSON.stringify({ type: "error", message: "Workspace not found" }));
                ws.close(1008, "Workspace not found");
                return;
              }

              const memberRole = await workspaceRepo.getMemberRole(
                ws.data.workspaceId,
                ws.data.userId
              );
              if (!memberRole) {
                ws.send(JSON.stringify({ type: "error", message: "Not a member of this workspace" }));
                ws.close(1008, "Not a member of this workspace");
                return;
              }

              // Mark as authenticated
              ws.data.isAuthenticated = true;
              wsService.handleConnect(ws);
              wsService.broadcastPresence(ws.data.workspaceId, ws.data.userId, "online");
              return;
            } catch (error) {
              console.error("JWT verification error:", error);
              ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
              ws.close(1008, "Invalid token");
              return;
            }
          }

          // Require authentication for subsequent messages
          if (!ws.data.isAuthenticated) {
            ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
            ws.close(1008, "Not authenticated");
            return;
          }

          // Rate limit check
          if (rateLimiter.isRateLimited(ws.data.userId.toString())) {
            ws.send(JSON.stringify({
              type: "error",
              message: "Rate limit exceeded. Please wait before sending more messages.",
            }));
            return;
          }

          // Dispatch on message type
          switch (data.type) {
            case "typing": {
              wsService.handleTypingIndicator(ws, {
                type: WSEventType.TYPING,
                payload: {
                  hubId: data.hubId,
                  userId: ws.data.userId,
                  isTyping: true,
                },
              });
              break;
            }
            case "chat": {
              // Instead of raw DB, call WriteService
              await writeService.handleMessage({
                type: "message",
                workspaceId: ws.data.workspaceId,
                hubId: data.payload.hubId,
                senderId: ws.data.userId,
                content: data.payload.content,
              });
              break;
            }
            default: {
              console.warn(`Unknown message type: ${data.type}`);
              ws.send(JSON.stringify({ type: "error", message: `Unknown type: ${data.type}` }));
            }
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
          ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
      },
      close(ws) {
        if (ws.data.isAuthenticated) {
          wsService.handleDisconnect(ws);
          wsService.broadcastPresence(ws.data.workspaceId, ws.data.userId, "offline");
        }
      },
    },
  });

  console.log(`✅ WebSocket server running on ws://localhost:${server.port}`);
  return server;
}