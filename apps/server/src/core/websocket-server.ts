// websocket-server.ts
import type { Server } from 'bun';
import { verify } from 'hono/jwt';
import { DatabaseService } from '../db/core/database';
import WriteService from '../services/write';
import { WebSocketService } from '../services/websockets';
import { WebSocketRateLimiter } from '../middleware/websocket-rate-limiter';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize services
const dbService = DatabaseService.getWriteInstance();
const writeService = new WriteService();
const wsService = new WebSocketService();
const rateLimiter = new WebSocketRateLimiter();

// Clean up rate limiter periodically
setInterval(() => rateLimiter.cleanup(), 60000);

interface WebSocketData {
  workspaceId: number;
  userId: number;
  authToken: string;
}

export function startWebSocketServer(port: number) {
  const server = Bun.serve<WebSocketData>({
    port,
    async fetch(req, server) {
      try {
        const url = new URL(req.url);
        const params = url.searchParams;
        
        // Validate auth token before upgrade
        const authToken = req.headers.get('Authorization')?.split(' ')[1];
        if (!authToken) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Verify JWT token
        try {
          const payload = await verify(authToken, JWT_SECRET);
          if (!payload || typeof payload.id !== 'number') {
            return new Response('Invalid token payload', { status: 401 });
          }
        } catch (error) {
          return new Response('Invalid token', { status: 401 });
        }

        const workspaceId = Number(params.get('workspace_id'));
        const userId = Number(params.get('user_id'));

        if (isNaN(workspaceId) || isNaN(userId)) {
          return new Response('Invalid workspace_id or user_id', { status: 400 });
        }

        const success = server.upgrade(req, {
          data: {
            workspaceId,
            userId,
            authToken
          }
        });

        return success ? undefined : new Response('WebSocket upgrade failed', { status: 400 });
      } catch (error) {
        console.error('WebSocket connection error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    },
    websocket: {
      open(ws) {
        wsService.handleConnect(ws);
        wsService.broadcastPresence(ws.data.workspaceId, ws.data.userId, 'online');
      },
      message(ws, message) {
        try {
          // Check rate limit
          if (rateLimiter.isRateLimited(ws.data.userId.toString())) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Rate limit exceeded. Please wait before sending more messages.'
            }));
            return;
          }

          const data = JSON.parse(String(message));
          
          switch (data.type) {
            case 'typing':
              wsService.handleTypingIndicator(ws.data.workspaceId, ws.data.userId);
              break;
              
            case 'chat':
              writeService.handleMessage({
                type: 'message',
                workspace_id: ws.data.workspaceId,
                channel_id: data.channelId,
                sender_id: ws.data.userId,
                content: data.content
              });
              break;

            default:
              console.warn(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      },
      close(ws) {
        wsService.handleDisconnect(ws);
        wsService.broadcastPresence(ws.data.workspaceId, ws.data.userId, 'offline');
      }
    }
  });

  console.log(`✅ WebSocket server running on ws://localhost:${server.port}`);
  return server;
}
