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
  send: (message: WebSocketEvent) => boolean;
  subscribe: <T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { state } = useWorkspace();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [wsManager] = useState(() => WebSocketManager.getInstance());

  // Enable debug mode in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      wsManager.setDebug(true);
    }
  }, [wsManager]);

  // Handle WebSocket connection
  useEffect(() => {
    const workspaceId = state.workspace?.id;
    
    if (!user?.id || !token || !workspaceId) {
      wsManager.disconnect();
      return;
    }

    // Subscribe to connection status
    const unsubStatus = wsManager.subscribeStatus(setStatus);

    // Connect
    wsManager.connect({
      token,
      workspaceId,
      userId: user.id,
    });

    return () => {
      unsubStatus();
      wsManager.disconnect();
    };
  }, [user?.id, token, state.workspace?.id, wsManager]);

  const send = useCallback((message: WebSocketEvent) => {
    return wsManager.send(message);
  }, [wsManager]);

  const subscribe = useCallback(<T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) => {
    return wsManager.subscribe(type, handler);
  }, [wsManager]);

  return (
    <WebSocketContext.Provider 
      value={{ status, send, subscribe }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook for accessing WebSocket context
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
}

// Hook for subscribing to specific message types
export function useWebSocketSubscription<T extends WSEventType>(
  type: T,
  handler: (message: Extract<WebSocketEvent, { type: T }>) => void,
  deps: React.DependencyList = []
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(type, handler);
    return () => unsubscribe();
  }, [type, subscribe, ...deps]); // Include handler in deps if it changes frequently
}

// Utility hook for sending messages
export function useWebSocketSender() {
  const { send, status } = useWebSocket();
  return {
    send,
    isConnected: status === 'connected'
  };
}
