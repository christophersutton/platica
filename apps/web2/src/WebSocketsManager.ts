type WSHandler = (data) => void;

export class WebSocketsManager {
  private static instance: WebSocketsManager;
  private ws: WebSocket;
  private handlers: Map<string, Set<WSHandler>>;

  private constructor(url: string) {
    this.ws = new WebSocket(url);
    this.handlers = new Map();

    this.ws.onopen = () => {
      console.log('[WS] Connected to', url);
    };
    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
    this.ws.onclose = () => {
      console.log('[WS] Connection closed');
    };
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type;
        if (this.handlers.has(eventType)) {
          for (const handler of this.handlers.get(eventType)!) {
            handler(data.payload);
          }
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', event.data, err);
      }
    };
  }

  static getInstance(url: string): WebSocketsManager {
    if (!WebSocketsManager.instance) {
      WebSocketsManager.instance = new WebSocketsManager(url);
    }
    return WebSocketsManager.instance;
  }

  subscribe(eventType: string, handler: WSHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  send(eventType: string, payload: any) {
    this.ws.send(JSON.stringify({ type: eventType, payload }));
  }
}