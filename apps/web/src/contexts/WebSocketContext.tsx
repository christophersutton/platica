import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { WebSocketMessage } from '@platica/shared/src/websocket';
import { WSEventType, validateMessage, WSErrorCode } from '@platica/shared/src/websocket';
import { useAuth } from '../hooks/use-auth';

enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

interface MessageHandler {
  (message: WebSocketMessage): void;
}

interface IWebSocketContext {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  sendMessage: (msg: WebSocketMessage) => void;
  subscribe: (eventType: WSEventType, handler: MessageHandler) => () => void;
}

const WebSocketContext = createContext<IWebSocketContext>({
  isConnected: false,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  sendMessage: () => {},
  subscribe: () => () => {},
});

interface WebSocketState {
  status: ConnectionStatus;
  retryCount: number;
  lastError?: string;
}

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const { workspaceId } = useParams();
  const parsedWorkspaceId = workspaceId ? Number(workspaceId) : undefined;
  
  const [state, setState] = useState<WebSocketState>({
    status: ConnectionStatus.DISCONNECTED,
    retryCount: 0,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<WSEventType, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<number>();

  const subscribe = useCallback((eventType: WSEventType, handler: MessageHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)?.add(handler);

    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
      if (handlersRef.current.get(eventType)?.size === 0) {
        handlersRef.current.delete(eventType);
      }
    };
  }, []);

  const dispatchMessage = useCallback((message: WebSocketMessage) => {
    const handlers = handlersRef.current.get(message.type);
    if (!handlers) return;

    // Create an array from the Set to avoid modification during iteration
    const handlersArray = Array.from(handlers);
    
    // Call all handlers for all message types
    handlersArray.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in message handler for ${message.type}:`, error);
      }
    });
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!token || !parsedWorkspaceId || !user?.id) {
      return;
    }

    setState(prev => ({ ...prev, status: ConnectionStatus.CONNECTING }));
    
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}?workspace_id=${parsedWorkspaceId}&user_id=${user.id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send authentication immediately
      ws.send(JSON.stringify({ 
        type: WSEventType.AUTH, 
        token: `Bearer ${token}` 
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (!validateMessage(data)) {
          console.error('Invalid message format:', data);
          return;
        }

        // Special handling for auth success/error
        if (data.type === WSEventType.ERROR && data.code === WSErrorCode.AUTHENTICATION_FAILED) {
          setState(prev => ({ 
            ...prev, 
            status: ConnectionStatus.ERROR,
            lastError: data.message 
          }));
          ws.close();
          return;
        }

        // If we get any message after auth, we're connected
        if (state.status === ConnectionStatus.CONNECTING) {
          setState(prev => ({ 
            ...prev, 
            status: ConnectionStatus.CONNECTED,
            retryCount: 0,
            lastError: undefined
          }));
        }

        dispatchMessage(data);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", event.data, err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setState(prev => ({ 
        ...prev, 
        status: ConnectionStatus.DISCONNECTED 
      }));
      
      // Only attempt reconnect if we were previously connected or connecting
      if (state.status === ConnectionStatus.CONNECTED || state.status === ConnectionStatus.CONNECTING) {
        const timeout = Math.min(1000 * Math.pow(2, state.retryCount), 30000);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
          connectWebSocket();
        }, timeout);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setState(prev => ({ 
        ...prev, 
        status: ConnectionStatus.ERROR,
        lastError: 'Connection error occurred'
      }));
    };
  }, [token, parsedWorkspaceId, user?.id, state.status, state.retryCount, dispatchMessage]);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const sendMessage = useCallback((msg: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('Attempted to send message while disconnected:', msg);
    }
  }, []);

  return (
    <WebSocketContext.Provider 
      value={{ 
        isConnected: state.status === ConnectionStatus.CONNECTED,
        connectionStatus: state.status,
        sendMessage,
        subscribe
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);

export const useWebSocketEvent = (eventType: WSEventType, handler: MessageHandler) => {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    return subscribe(eventType, handler);
  }, [subscribe, eventType, handler]);
};

export { WebSocketContext }; 