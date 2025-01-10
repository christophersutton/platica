import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";
import { WSEventType } from "@platica/shared/src/websockets";
import type { WebSocketEvent } from "@platica/shared/src/websockets";
import { WebSocketManager } from "@/lib/websocket/manager";
import type { ConnectionStatus } from "@/lib/websocket/types";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";

interface WebSocketContextValue {
  status: ConnectionStatus;
  // Type-safe message sending
  send: (message: WebSocketEvent) => boolean;
  // Type-safe message subscription
  subscribe: <T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { state } = useWorkspace();
  
  
  console.log("WebSocketProvider", user?.id, token, state);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const workspaceId = state.workspace?.id;
    
    if (!user?.id || !token || !workspaceId) {
      return;
    }
    console.log("inside useEffeect", user?.id, token, workspaceId);
    const ws = WebSocketManager.getInstance();

    // Subscribe to connection status
    const unsubStatus = ws.subscribeStatus(setStatus);

    // Connect
    console.log("Connecting to WebSocket");
    ws.connect({
      token,
      workspaceId,
      userId: user.id,
    });
    console.log("Connected to WebSocket");
    return () => {
      unsubStatus();
      ws.disconnect();
    };
  }, [user, token, state]);

  const send = useCallback((message: WebSocketEvent) => {
    return WebSocketManager.getInstance().send(message);
  }, []);

  const subscribe = useCallback(
    <T extends WSEventType>(
      type: T,
      handler: (message: Extract<WebSocketEvent, { type: T }>) => void
    ) => {
      return WebSocketManager.getInstance().subscribe(type, handler);
    },
    []
  );

  const value: WebSocketContextValue = {
    status,
    send,
    subscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
}

// Utility hooks for specific WS events:
export function useWebSocketSubscription<T extends WSEventType>(
  type: T,
  handler: (message: Extract<WebSocketEvent, { type: T }>) => void
) {
  const { subscribe } = useWebSocket();
  useEffect(() => {
    return subscribe(type, handler);
  }, [type, handler, subscribe]);
}
