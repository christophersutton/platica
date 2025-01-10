import type { WebSocketEvent } from '@platica/shared/src/websockets'
import type { WSEventType } from '@platica/shared/src/websockets'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface WebSocketConfig {
  token: string
  workspaceId: number
  userId: number
}

export interface MessageQueueItem {
  message: WebSocketEvent
  attempts: number
  lastAttempt: number
  maxAttempts: number
}

// Type-safe message handler map
export type MessageHandlerMap = {
  [K in WSEventType]?: Set<(message: Extract<WebSocketEvent, { type: K }>) => void>
}