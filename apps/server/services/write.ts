import type { ServerWebSocket } from 'bun';
import { MessageRepository } from '../db/messages-repository';
import { DatabaseService } from '../db/database';
import type { WSEventType } from '@platica/shared/types';

interface Message {
  type: 'message' | 'reaction' | 'typing';
  workspace_id: number;
  channel_id?: number;
  sender_id: number;
  content?: string;
  thread_id?: number;
}

interface WebSocketData {
  workspaceId: number;
  userId: number;
  authToken: string;
}

export class WriteService {
  private messageRepository: MessageRepository;
  private wsClients: Map<number, ServerWebSocket<WebSocketData>[]> = new Map(); // workspace_id -> clients
  
  constructor() {
    // Use the singleton write instance
    const dbService = DatabaseService.getWriteInstance();
    this.messageRepository = new MessageRepository(dbService);
  }

  async handleMessage(message: Message): Promise<void> {
    const { type, workspace_id, channel_id, sender_id, content, thread_id } = message;
    
    switch (type) {
      case 'message': {
        const messageId = this.messageRepository.createMessage({
          workspace_id,
          channel_id,
          sender_id,
          content,
          thread_id
        });
        
        this.broadcastToWorkspace(workspace_id, {
          type: 'new_message',
          message_id: messageId,
          workspace_id,
          channel_id,
          sender_id,
          content,
          thread_id
        });
        break;
      }

      case 'reaction':
        // Handle reaction logic
        break;

      case 'typing':
        // Broadcast typing indicator without DB write
        this.broadcastToWorkspace(workspace_id, message);
        break;
    }
  }

  private broadcastToWorkspace(workspace_id: number, data: any) {
    const clients = this.wsClients.get(workspace_id) || [];
    const message = JSON.stringify(data);
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  addClient(workspace_id: number, ws: ServerWebSocket<WebSocketData>) {
    if (!this.wsClients.has(workspace_id)) {
      this.wsClients.set(workspace_id, []);
    }
    this.wsClients.get(workspace_id)!.push(ws);
  }

  removeClient(workspace_id: number, ws: ServerWebSocket<WebSocketData>) {
    const clients = this.wsClients.get(workspace_id);
    if (clients) {
      const index = clients.indexOf(ws);
      if (index > -1) {
        clients.splice(index, 1);
      }
    }
  }
}

export default WriteService;
