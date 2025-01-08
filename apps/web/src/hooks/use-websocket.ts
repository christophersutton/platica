import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAuth } from './use-auth.ts';
import type { Channel } from '@/lib/api';

type OutgoingChatMessage = {
  type: 'chat';
  channelId: number;
  content: string;
  userId: number;
}

type ChatMessage = {
  type: 'chat';
  channelId: number;
  content: string;
  userId: number;
  messageId: number;
  createdAt: number;
  sender_name: string;
  avatar_url?: string;
  threadId?: number | null;
}

type PresenceMessage = {
  type: 'presence';
  userId: number;
  status?: 'online' | 'offline';
}

type PresenceSyncMessage = {
  type: 'presence_sync';
  onlineUsers: number[];
}

type TypingMessage = {
  type: 'typing';
  channelId: number;
  userId: number;
  isTyping: boolean;
}

type ChannelCreatedMessage = {
  type: 'channel_created';
  channel: Channel;
}

type ErrorMessage = {
  type: 'error';
  message: string;
}

export type WebSocketMessage = 
  | OutgoingChatMessage
  | ChatMessage 
  | PresenceMessage 
  | PresenceSyncMessage 
  | TypingMessage 
  | ChannelCreatedMessage 
  | ErrorMessage;

interface UseWebSocketOptions {
  workspaceId: number;
  onMessage?: (message: WebSocketMessage) => void;
  onPresenceChange?: (userId: number, status: 'online' | 'offline') => void;
  onTypingIndicator?: (channelId: number, userId: number, isTyping: boolean) => void;
  onChannelCreated?: (channel: Channel) => void;
  onError?: (error: string) => void;
}

export function useWebSocket({
  workspaceId,
  onMessage,
  onPresenceChange,
  onTypingIndicator,
  onChannelCreated,
  onError
}: UseWebSocketOptions) {
  const { user, token, isLoading, isInitialized } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);
  const lastConnectionParamsRef = useRef<{ token: string; userId: number; workspaceId: number } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Memoize handlers to prevent unnecessary reconnections
  const handlers = useMemo(() => ({
    onMessage,
    onPresenceChange,
    onTypingIndicator,
    onChannelCreated,
    onError
  }), [onMessage, onPresenceChange, onTypingIndicator, onChannelCreated, onError]);

  // Only attempt connection if we have all required data
  const shouldConnect = useMemo(() => {
    const conditions = {
      isInitialized,
      notLoading: !isLoading,
      hasUser: Boolean(user),
      hasToken: Boolean(token),
      hasWorkspaceId: Boolean(workspaceId && workspaceId > 0)
    };
    
    console.log('[WebSocket] Connection conditions:', conditions);
    
    return Boolean(
      conditions.isInitialized && 
      conditions.notLoading && 
      conditions.hasUser && 
      conditions.hasToken && 
      conditions.hasWorkspaceId
    );
  }, [isInitialized, isLoading, user, token, workspaceId]);

  const resetConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Reset connection');
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    isConnectingRef.current = false;
    lastConnectionParamsRef.current = null;
    reconnectAttemptsRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (!shouldConnect) {
      console.log('WebSocket: Not connecting - missing required data');
      resetConnection();
      setIsConnected(false);
      return;
    }

    // Don't attempt connection until auth is fully initialized
    if (!isInitialized) {
      console.log('WebSocket: Waiting for auth initialization...');
      return;
    }

    // If still loading, wait
    if (isLoading) {
      console.log('WebSocket: Auth state is loading...');
      return;
    }

    // Only attempt connection if we have valid credentials
    if (!user || !token) {
      console.warn('WebSocket: No auth credentials available', { user: !!user, token: !!token });
      resetConnection();
      return;
    }

    if (!workspaceId) {
      console.warn('WebSocket: Waiting for valid workspace ID...');
      return;
    }

    const connectionParams = {
      token,
      userId: user.id,
      workspaceId,
    };

    // If we're already connected with the same parameters, do nothing
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      lastConnectionParamsRef.current &&
      lastConnectionParamsRef.current.token === connectionParams.token &&
      lastConnectionParamsRef.current.userId === connectionParams.userId &&
      lastConnectionParamsRef.current.workspaceId === connectionParams.workspaceId
    ) {
      console.log('WebSocket: Already connected with same parameters');
      return;
    }

    // Reset if parameters changed
    if (
      lastConnectionParamsRef.current &&
      (
        lastConnectionParamsRef.current.token !== connectionParams.token ||
        lastConnectionParamsRef.current.userId !== connectionParams.userId ||
        lastConnectionParamsRef.current.workspaceId !== connectionParams.workspaceId
      )
    ) {
      console.log('WebSocket: Connection parameters changed, resetting connection');
      resetConnection();
    }

    lastConnectionParamsRef.current = connectionParams;

    if (isConnectingRef.current) {
      console.log('WebSocket: Connection in progress');
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('WebSocket: Max reconnection attempts reached', {
        attempts: reconnectAttemptsRef.current,
        max: maxReconnectAttempts,
      });
      return;
    }

    try {
      isConnectingRef.current = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = '3001';
      const wsUrl = `${protocol}//${host}:${port}?workspace_id=${workspaceId}&user_id=${user.id}`;

      console.log('WebSocket: Connecting...', {
        url: wsUrl,
        attempt: reconnectAttemptsRef.current + 1,
        maxAttempts: maxReconnectAttempts,
      });

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket: Connection timeout');
          ws.close();
          setIsConnected(false);
        }
      }, 5000);

      ws.addEventListener('open', () => {
        clearTimeout(connectionTimeout);
        isConnectingRef.current = false;
        ws.send(JSON.stringify({
          type: 'auth',
          token: `Bearer ${token}`,
        }));
        console.log('WebSocket: Connected successfully');
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          
          if (data.type === 'error') {
            console.error('WebSocket: Server error', data.message);
            if (data.message?.includes('token') || data.message?.includes('auth')) {
              resetConnection();
              return;
            }
          }

          // First pass message to general handler if provided
          handlers.onMessage?.(data);

          // Then handle specific message types
          switch (data.type) {
            case 'chat':
              // Chat messages are handled by the general onMessage handler
              break;
            case 'presence':
              if (data.status) {
                handlers.onPresenceChange?.(data.userId, data.status);
              }
              break;
            case 'presence_sync':
              // Presence sync is handled by the general onMessage handler
              break;
            case 'typing':
              handlers.onTypingIndicator?.(data.channelId, data.userId, data.isTyping ?? false);
              break;
            case 'channel_created':
              handlers.onChannelCreated?.(data.channel);
              break;
            case 'error':
              if (data.message?.includes('token') || data.message?.includes('auth')) {
                resetConnection();
                return;
              }
              handlers.onError?.(data.message);
              break;
          }
        } catch (error) {
          console.error('WebSocket: Failed to parse message:', error);
        }
      });

      ws.addEventListener('close', (event) => {
        console.warn('WebSocket: Disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          attempts: reconnectAttemptsRef.current,
        });
        wsRef.current = null;
        isConnectingRef.current = false;
        setIsConnected(false);
        clearTimeout(connectionTimeout);

        // Attempt to reconnect only if not a clean closure (1000 or 1001)
        if (event.code !== 1000 && event.code !== 1001) {
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            console.log('WebSocket: Scheduling reconnect...', {
              attempt: reconnectAttemptsRef.current + 1,
              backoffTime,
              maxAttempts: maxReconnectAttempts,
            });
            reconnectTimeoutRef.current = window.setTimeout(connect, backoffTime);
          }
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket: Connection error', error);
        isConnectingRef.current = false;
        setIsConnected(false);
        onError?.('WebSocket connection error');
      });
    } catch (error) {
      console.error('WebSocket: Failed to create connection:', error);
      isConnectingRef.current = false;
      setIsConnected(false);
      onError?.('Failed to create WebSocket connection');
    }
  }, [shouldConnect, workspaceId, user?.id, token, onError, resetConnection]);

  useEffect(() => {
    connect();
    return () => {
      resetConnection();
      setIsConnected(false);
    };
  }, [connect, resetConnection]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket: Cannot send message - connection not open');
      return;
    }
    wsRef.current.send(JSON.stringify(message));
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      
      // Call the general message handler if provided
      handlers.onMessage?.(message);

      // Handle specific message types
      switch (message.type) {
        case 'presence':
          handlers.onPresenceChange?.(message.userId, message.status || 'online');
          break;
        case 'presence_sync':
          // Handle presence sync
          break;
        case 'typing':
          handlers.onTypingIndicator?.(message.channelId, message.userId, message.isTyping ?? false);
          break;
        case 'channel_created':
          handlers.onChannelCreated?.(message.channel);
          break;
        case 'error':
          handlers.onError?.(message.message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse websocket message:', error);
    }
  }, [handlers]);

  return {
    sendMessage,
    isConnected,
  };
}