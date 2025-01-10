import { useEffect } from "react";
import { WebSocketManager } from "@/lib/websocket/manager";
import type { ConnectionStatus } from "@/lib/websocket/types";
import type { WebSocketEvent } from "@platica/shared/websockets";
import { WSEventType } from "@platica/shared/websockets";

export function useWebSocket(config: {
  token: string;
  workspaceId: number;
  userId: number;
  onMessage: (message: WebSocketEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
}) {
  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    
    // Enable debug mode
    wsManager.setDebug(true);
    
    // Subscribe to status updates
    const unsubStatus = wsManager.subscribeStatus(config.onStatus);
    
    // Subscribe to all message types
    const unsubMessages = Object.values(WSEventType).map(type => 
      wsManager.subscribe(type, config.onMessage)
    );

    // Connect if needed
    wsManager.connect({
      token: config.token,
      workspaceId: config.workspaceId,
      userId: config.userId
    });

    return () => {
      unsubStatus();
      unsubMessages.forEach(unsub => unsub());
    };
  }, [config.token, config.workspaceId, config.userId, config.onMessage, config.onStatus]);

  return {
    send: (message: WebSocketEvent) => 
      WebSocketManager.getInstance().send(message)
  };
}