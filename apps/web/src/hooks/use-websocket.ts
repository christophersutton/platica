import type { WebSocketMessage } from "@/contexts/AppContext";
import { useEffect } from "react";
import { WebSocketManager } from "@/lib/websocket";

export function useWebSocket(config: {
  token: string;
  workspaceId: number;
  userId: number;
  onMessage: (message: WebSocketMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}) {
  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    
    // Subscribe to events
    const unsubscribe = wsManager.subscribe({
      onMessage: config.onMessage,
      onStatus: config.onStatus
    });

    // Connect if needed
    wsManager.connect({
      token: config.token,
      workspaceId: config.workspaceId,
      userId: config.userId
    });

    return () => {
      unsubscribe();
    };
  }, [config.token, config.workspaceId, config.userId]);

  return {
    send: (message: WebSocketMessage) => 
      WebSocketManager.getInstance().send(message)
  };
}