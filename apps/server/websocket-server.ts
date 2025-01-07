// websocket-server.ts
import type { Server } from 'bun';
import WriteService from './services/write';
import { WebSocketService } from './services/websockets';

interface WebSocketData {
  workspaceId: number;
  userId: number;
  authToken: string;
}

export function startWebSocketServer(port: number) {
  const writeService = new WriteService();
  const wsService = new WebSocketService();

  const server = Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      try {
        const url = new URL(req.url);
        const params = url.searchParams;
        
        // Validate auth token before upgrade
        const authToken = req.headers.get('Authorization')?.split(' ')[1];
        if (!authToken) {
          return new Response('Unauthorized', { status: 401 });
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
