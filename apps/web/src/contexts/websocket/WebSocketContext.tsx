import React, { createContext, useContext, useCallback } from 'react'
import { WebSocketManager } from '@/lib/websocket/manager'
import type { WebSocketEvent } from '@platica/shared/src/websockets'
import { WSEventType } from '@platica/shared/src/websockets'
import type { ConnectionStatus } from '@/lib/websocket/types'

interface WebSocketContextValue {
  status: ConnectionStatus
  send: (message: WebSocketEvent) => boolean
  subscribe: <T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) => () => void
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<ConnectionStatus>('disconnected')

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
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
} 