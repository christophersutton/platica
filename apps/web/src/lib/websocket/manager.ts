import {
  WSEventType,
  validateMessage
} from '@platica/shared/src/websockets'
import type {
  WebSocketEvent
} from '@platica/shared/src/websockets'
import type {
  ConnectionStatus,
  WebSocketConfig,
  MessageHandlerMap,
  MessageQueueItem
} from './types'

const MAX_QUEUE_SIZE = 100
const MAX_RETRY_ATTEMPTS = 3
const RETRY_BACKOFF_MS = 1000
const MAX_RECONNECT_ATTEMPTS = 5

export class WebSocketManager {
  private static instance: WebSocketManager
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimeout: number | null = null
  private config: WebSocketConfig | null = null
  private messageQueue: MessageQueueItem[] = []
  private queueProcessorInterval: number | null = null
  private debug: boolean = false

  // Type-specific message handlers with proper typing
  private messageHandlers: MessageHandlerMap = {
    [WSEventType.AUTH]: new Set(),
    [WSEventType.ERROR]: new Set(),
    [WSEventType.PRESENCE]: new Set(),
    [WSEventType.PRESENCE_SYNC]: new Set(),
    [WSEventType.TYPING]: new Set(),
    [WSEventType.CHAT]: new Set(),
    [WSEventType.CHANNEL_CREATED]: new Set(),
    [WSEventType.CHANNEL_MEMBER_ADDED]: new Set(),
    [WSEventType.CHANNEL_MEMBER_REMOVED]: new Set(),
    [WSEventType.CHANNEL_MEMBER_UPDATED]: new Set()
  }

  private statusHandlers = new Set<(status: ConnectionStatus) => void>()

  private constructor() {
    this.startQueueProcessor()
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  private log(...args: unknown[]) {
    if (this.debug) {
      console.log('[WebSocket]', ...args)
    }
  }

  setDebug(enabled: boolean) {
    this.debug = enabled
  }

  private handleIncomingMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      // Validate the message structure
      if (!validateMessage(data)) {
        this.log('Invalid message received:', data)
        return
      }

      const message = data as WebSocketEvent
      
      // Get handlers for this message type
      const handlers = this.messageHandlers[message.type]
      
      if (handlers?.size) {
        handlers.forEach(handler => {
          try {
            // Type assertion is safe here because MessageHandlerMap ensures handler type matches message type
            (handler as (msg: WebSocketEvent) => void)(message)
          } catch (err) {
            this.log('Error in message handler:', err)
          }
        })
      }
    } catch (err) {
      this.log('Failed to parse WebSocket message:', err)
    }
  }

  connect(config: WebSocketConfig) {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.config = config
    this.updateStatus('connecting')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = '3001'
    const wsUrl = `${protocol}//${host}:${port}?workspace_id=${config.workspaceId}&user_id=${config.userId}`
    
    this.log('Connecting to', wsUrl)

    try {
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.updateStatus('connected')
        this.ws?.send(JSON.stringify({
          type: WSEventType.AUTH,
          payload: {
            token: `Bearer ${config.token}`
          }
        }))
        
        // Process any queued messages
        this.processQueue()
      }

      this.ws.onmessage = this.handleIncomingMessage
      
      this.ws.onclose = (event) => {
        this.log('WebSocket closed:', event.code, event.reason)
        this.ws = null
        this.updateStatus('disconnected')

        if (event.code !== 1000 && event.code !== 1001) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = (error) => {
        this.log('WebSocket error:', error)
        this.updateStatus('disconnected')
      }

    } catch (err) {
      this.log('Failed to create WebSocket:', err)
      this.updateStatus('disconnected')
    }
  }

  private scheduleReconnect() {
    if (!this.config || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return
    }

    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++
      if (this.config) {
        this.connect(this.config)
      }
    }, backoff)
  }

  private startQueueProcessor() {
    if (this.queueProcessorInterval) return

    this.queueProcessorInterval = window.setInterval(() => {
      this.processQueue()
    }, 1000)
  }

  private processQueue() {
    if (!this.messageQueue.length || this.ws?.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    const itemsToProcess = this.messageQueue.filter(item => {
      const timeSinceLastAttempt = now - item.lastAttempt
      return timeSinceLastAttempt > RETRY_BACKOFF_MS * Math.pow(2, item.attempts)
    })

    itemsToProcess.forEach(item => {
      try {
        this.ws?.send(JSON.stringify(item.message))
        this.messageQueue = this.messageQueue.filter(i => i !== item)
      } catch (err) {
        item.attempts++
        item.lastAttempt = now
        if (item.attempts >= item.maxAttempts) {
          this.messageQueue = this.messageQueue.filter(i => i !== item)
          this.log('Message dropped after max attempts:', item)
        }
      }
    })
  }

  send(message: WebSocketEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message))
        return true
      } catch (err) {
        this.queueMessage(message)
        return false
      }
    } else {
      this.queueMessage(message)
      return false
    }
  }

  private queueMessage(message: WebSocketEvent) {
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      this.messageQueue.shift() // Remove oldest message
    }

    this.messageQueue.push({
      message,
      attempts: 0,
      lastAttempt: Date.now(),
      maxAttempts: MAX_RETRY_ATTEMPTS
    })
  }

  private updateStatus(status: ConnectionStatus) {
    this.statusHandlers.forEach(handler => handler(status))
  }

  subscribe<T extends WSEventType>(
    type: T,
    handler: (message: Extract<WebSocketEvent, { type: T }>) => void
  ) {
    const handlers = this.messageHandlers[type]
    if (handlers) {
      // We know this handler matches the message type due to our MessageHandlerMap type
      handlers.add(handler)
    }

    return () => {
      if (handlers) {
        handlers.delete(handler)
      }
    }
  }

  subscribeStatus(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers.add(handler)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000)
      this.ws = null
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    this.updateStatus('disconnected')
  }
}