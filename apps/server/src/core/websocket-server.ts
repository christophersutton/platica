// websocket-server.ts
import { verify } from "hono/jwt";
import { DatabaseService } from "../db/core/database";
import { WebSocketService } from "../services/websockets";
import { WebSocketRateLimiter } from "../middleware/websocket-rate-limiter";
import { WSEventType, type OutgoingChatEvent } from "@websockets";
import WriteService from "../services/write";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Initialize services
const dbService = DatabaseService.getWriteInstance();
const wsService = WebSocketService.getInstance();
const writeService = new WriteService(wsService);
const rateLimiter = new WebSocketRateLimiter();

// Clean up rate limiter periodically
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
        const params = url.searchParams;

        const workspaceId = Number(params.get("workspace_id"));
        const userId = Number(params.get("user_id"));

        if (isNaN(workspaceId) || isNaN(userId)) {
          return new Response("Invalid workspace_id or user_id", {
            status: 400,
          });
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

          // Handle authentication message
          if (data.type === "auth") {
            const authMessage = data.payload as AuthMessage;
            console.log("Auth message:", authMessage);
            console.log("Token:", authMessage.token);
            
            if (!authMessage.token?.startsWith("Bearer ")) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Invalid token format",
                })
              );
              ws.close(1008, "Invalid token format");
              return;
            }

            const token = authMessage.token.split(" ")[1];
            try {
              const payload = await verify(token, JWT_SECRET);
              if (
                !payload ||
                typeof payload.id !== "number" ||
                payload.id !== ws.data.userId
              ) {
                ws.send(
                  JSON.stringify({ type: "error", message: "Invalid token" })
                );
                ws.close(1008, "Invalid token");
                return;
              }

              // Verify workspace membership
              console.log(
                "Token verification successful for user:",
                ws.data.userId
              );

              try {
                console.log("Database instance:", {
                  isConnected: dbService.db !== null,
                  path: dbService.db.filename,
                });

                // First check if the workspace exists
                const workspace = dbService.db
                  .prepare(
                    `
                  SELECT id, name FROM workspaces WHERE id = ?
                `
                  )
                  .get(ws.data.workspaceId);

                // Add user metadata lookup
                const getUserMetadata = dbService.db.prepare(`
                  SELECT name as sender_name, avatar_url
                  FROM users
                  WHERE id = ?
                `);

                console.log("Workspace check:", {
                  workspaceId: ws.data.workspaceId,
                  found: !!workspace,
                  workspace,
                });

                // Then check workspace membership
                const isMember = dbService.db
                  .prepare(
                    `
                  SELECT wu.*, w.name as workspace_name, u.email as user_email
                  FROM workspace_users wu
                  JOIN workspaces w ON w.id = wu.workspace_id
                  JOIN users u ON u.id = wu.user_id
                  WHERE wu.workspace_id = ? AND wu.user_id = ?
                `
                  )
                  .get(ws.data.workspaceId, ws.data.userId);

                console.log("Workspace membership check:", {
                  workspaceId: ws.data.workspaceId,
                  userId: ws.data.userId,
                  isMember: !!isMember,
                  details: isMember,
                });

                if (!workspace) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      message: "Workspace not found",
                    })
                  );
                  ws.close(1008, "Workspace not found");
                  return;
                }

                if (!isMember) {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      message: "Not a member of this workspace",
                    })
                  );
                  ws.close(1008, "Not a member of this workspace");
                  return;
                }
              } catch (error) {
                console.error(
                  "Database error during workspace membership check:",
                  error
                );
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Database error checking workspace membership",
                  })
                );
                ws.close(1011, "Database error");
                return;
              }

              // Mark as authenticated
              ws.data.isAuthenticated = true;
              wsService.handleConnect(ws);
              wsService.broadcastPresence(
                ws.data.workspaceId,
                ws.data.userId,
                "online"
              );
              return;
            } catch (error) {
              ws.send(
                JSON.stringify({ type: "error", message: "Invalid token" })
              );
              ws.close(1008, "Invalid token");
              return;
            }
          }

          // Require authentication for all other messages
          if (!ws.data.isAuthenticated) {
            ws.send(
              JSON.stringify({ type: "error", message: "Not authenticated" })
            );
            ws.close(1008, "Not authenticated");
            return;
          }

          // Check rate limit
          if (rateLimiter.isRateLimited(ws.data.userId.toString())) {
            ws.send(
              JSON.stringify({
                type: "error",
                message:
                  "Rate limit exceeded. Please wait before sending more messages.",
              })
            );
            return;
          }

          switch (data.type) {
            case "typing":
              wsService.handleTypingIndicator(ws, {
                type: WSEventType.TYPING,
                payload: {
                  channelId: data.channelId,
                  userId: ws.data.userId,
                  isTyping: true,
                },
              });
              break;

            case "chat": {
              console.log("[WebSocket Server] Received chat message:", data);

              // Get user metadata for the message
              
              const formattedMessage: OutgoingChatEvent = {
                type: WSEventType.CHAT,
                payload: data.payload
              };

              await wsService.handleMessage(
                ws,
                JSON.stringify(formattedMessage)
              );

              // Also save to database
              await writeService.handleMessage({
                type: "message",
                workspaceId: ws.data.workspaceId,
                channelId: data.payload.channelId,
                senderId: ws.data.userId,
                content: data.payload.content,
              });

              console.log("[WebSocket Server] Processed chat message");
              break;
            }

            default:
              console.warn(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
          ws.send(
            JSON.stringify({ type: "error", message: "Invalid message format" })
          );
        }
      },
      close(ws) {
        if (ws.data.isAuthenticated) {
          wsService.handleDisconnect(ws);
          wsService.broadcastPresence(
            ws.data.workspaceId,
            ws.data.userId,
            "offline"
          );
        }
      },
    },
  });

  console.log(`✅ WebSocket server running on ws://localhost:${server.port}`);
  return server;
}
