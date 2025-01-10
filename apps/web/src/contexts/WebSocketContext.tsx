import React, { createContext, useContext, useEffect, useCallback } from 'react'
import { WSEventType } from '@platica/shared/src/websockets'
import type { 
  WebSocketEvent,
  ChatEvent,
  PresenceEvent,
  TypingEvent
} from '@platica/shared/src/websockets'
import { WebSocketManager } from '@/lib/websocket/manager'
import type { ConnectionStatus } from '@/lib/websocket/types'
import { useAuth } from './AuthContext'

interface WebSocketContextValue {
  status: ConnectionStatus
  // Type-safe message sending
  send: (message: WebSocketEvent) => boolean
  // Type-safe message subscription
  subscribe: <T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) => () => void
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ 
  children,
  workspaceId 
}: { 
  children: React.ReactNode
  workspaceId: number 
}) {
  const { user, token } = useAuth()
  const [status, setStatus] = React.useState<ConnectionStatus>('disconnected')

  useEffect(() => {
    if (!user?.id || !token || !workspaceId) {
      return
    }

    const ws = WebSocketManager.getInstance()

    // Subscribe to connection status
    const unsubStatus = ws.subscribeStatus(setStatus)

    // Connect
    ws.connect({
      token,
      workspaceId,
      userId: user.id
    })

    return () => {
      unsubStatus()
      ws.disconnect()
    }
  }, [user?.id, token, workspaceId])

  const send = useCallback((message: WebSocketEvent) => {
    return WebSocketManager.getInstance().send(message)
  }, [])

  const subscribe = useCallback(<T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) => {
    return WebSocketManager.getInstance().subscribe(type, handler)
  }, [])

  const value = {
    status,
    send,
    subscribe
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider')
  }
  return context
}

// Utility hooks for common operations
export function useWebSocketSubscription<T extends WSEventType>(
  type: T,
  handler: (message: Extract<WebSocketEvent, { type: T }>) => void
) {
  const { subscribe } = useWebSocket()

  useEffect(() => {
    return subscribe(type, handler)
  }, [type, handler, subscribe])
}

export function useChatMessages(
  handler: (message: Extract<WebSocketEvent, { type: WSEventType.CHAT }>) => void
) {
  useWebSocketSubscription(WSEventType.CHAT, handler)
}

export function usePresence(
  handler: (message: Extract<WebSocketEvent, { type: WSEventType.PRESENCE }>) => void
) {
  useWebSocketSubscription(WSEventType.PRESENCE, handler)
}

export function useTypingIndicator(
  handler: (message: Extract<WebSocketEvent, { type: WSEventType.TYPING }>) => void
) {
  useWebSocketSubscription(WSEventType.TYPING, handler)
}

// Example usage:
/*
function ChatComponent() {
  const { status, send } = useWebSocket()
  
  useChatMessages((message) => {
    console.log('New chat message:', message)
    // TypeScript knows message is a ChatMessage
  })

  const sendMessage = (content: string) => {
    send({
      type: WSEventType.CHAT,
      channelId: 1,
      content,
      userId: 1
    })
  }

  return (...)
}
*/