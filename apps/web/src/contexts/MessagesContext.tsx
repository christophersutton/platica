import React, { createContext, useContext, useCallback, useReducer, useEffect } from 'react'
import { useWebSocket, useWebSocketSubscription } from './WebSocketContext'
import { api } from '@/lib/api'
import { WSEventType } from '@platica/shared/src/websockets'
import type { ChatEvent, OutgoingChatEvent, WebSocketEvent } from '@platica/shared/src/websockets'
import type { Message, UiMessage } from '@models/message'
import type { ValidatedUnixTimestamp } from '@types'
import { ensureUnixTimestamp } from '@platica/shared/src/utils/time'

// Normalized message store type
interface NormalizedMessages {
  byId: Record<number, UiMessage>
  byChannel: Record<number, number[]>
  loadingChannels: Record<number, boolean>
  errors: Record<number, Error | null>
  hasMore: Record<number, boolean>
}

type MessagesState = {
  messages: NormalizedMessages
  activeChannel: number | null
}

type MessagesAction = 
  | { type: 'SET_ACTIVE_CHANNEL'; channelId: number }
  | { type: 'SET_LOADING'; channelId: number }
  | { type: 'SET_ERROR'; channelId: number; error: Error }
  | { type: 'SET_MESSAGES'; channelId: number; messages: Message[] }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'UPDATE_MESSAGE'; messageId: number; updates: Partial<Message> }
  | { type: 'SET_HAS_MORE'; channelId: number; hasMore: boolean }
  | { type: 'CLEAR_CHANNEL_MESSAGES'; channelId: number }

const initialState: MessagesState = {
  messages: {
    byId: {},
    byChannel: {},
    loadingChannels: {},
    errors: {},
    hasMore: {}
  },
  activeChannel: null
}

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'SET_ACTIVE_CHANNEL':
      return {
        ...state,
        activeChannel: action.channelId
      }

    case 'SET_LOADING':
      return {
        ...state,
        messages: {
          ...state.messages,
          loadingChannels: {
            ...state.messages.loadingChannels,
            [action.channelId]: true
          },
          errors: {
            ...state.messages.errors,
            [action.channelId]: null
          }
        }
      }

    case 'SET_ERROR':
      return {
        ...state,
        messages: {
          ...state.messages,
          loadingChannels: {
            ...state.messages.loadingChannels,
            [action.channelId]: false
          },
          errors: {
            ...state.messages.errors,
            [action.channelId]: action.error
          }
        }
      }

    case 'SET_MESSAGES': {
      const newById = { ...state.messages.byId }
      const messageIds: number[] = []

      action.messages.forEach(msg => {
        newById[msg.id] = {
          ...msg,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          deletedAt: msg.deletedAt,
          isHighlighted: false,
          isPending: false,
          isDeleting: false,
          reactionCount: 0,
          replyCount: 0,
          hasThread: !!msg.threadId
        }
        messageIds.push(msg.id)
      })

      return {
        ...state,
        messages: {
          ...state.messages,
          byId: newById,
          byChannel: {
            ...state.messages.byChannel,
            [action.channelId]: messageIds
          },
          loadingChannels: {
            ...state.messages.loadingChannels,
            [action.channelId]: false
          }
        }
      }
    }

    case 'ADD_MESSAGE': {
      const channelId = action.message.channelId
      const channelMessages = state.messages.byChannel[channelId] || []
      
      // Check for duplicates
      if (channelMessages.includes(action.message.id)) {
        return state
      }

      const message: UiMessage = {
        ...action.message,
        createdAt: action.message.createdAt,
        updatedAt: action.message.updatedAt,
        deletedAt: action.message.deletedAt,
        isHighlighted: false,
        isPending: false,
        isDeleting: false,
        reactionCount: 0,
        replyCount: 0,
        hasThread: !!action.message.threadId
      }

      return {
        ...state,
        messages: {
          ...state.messages,
          byId: {
            ...state.messages.byId,
            [action.message.id]: message
          },
          byChannel: {
            ...state.messages.byChannel,
            [channelId]: [...channelMessages, action.message.id]
          }
        }
      }
    }

    case 'UPDATE_MESSAGE': {
      const existingMessage = state.messages.byId[action.messageId]
      if (!existingMessage) {
        return state
      }

      const updates = { ...action.updates }

      return {
        ...state,
        messages: {
          ...state.messages,
          byId: {
            ...state.messages.byId,
            [action.messageId]: {
              ...existingMessage,
              ...updates
            }
          }
        }
      }
    }

    case 'SET_HAS_MORE':
      return {
        ...state,
        messages: {
          ...state.messages,
          hasMore: {
            ...state.messages.hasMore,
            [action.channelId]: action.hasMore
          }
        }
      }

    case 'CLEAR_CHANNEL_MESSAGES': {
      const { [action.channelId]: _, ...remainingChannelMessages } = state.messages.byChannel
      const messageIds = state.messages.byChannel[action.channelId] || []
      const newById = { ...state.messages.byId }
      
      messageIds.forEach(id => {
        delete newById[id]
      })

      return {
        ...state,
        messages: {
          ...state.messages,
          byId: newById,
          byChannel: remainingChannelMessages,
          loadingChannels: {
            ...state.messages.loadingChannels,
            [action.channelId]: false
          },
          errors: {
            ...state.messages.errors,
            [action.channelId]: null
          },
          hasMore: {
            ...state.messages.hasMore,
            [action.channelId]: false
          }
        }
      }
    }

    default:
      return state
  }
}

interface MessagesContextValue {
  messages: NormalizedMessages
  activeChannel: number | null
  setActiveChannel: (channelId: number) => void
  loadMessages: (channelId: number) => Promise<void>
  sendMessage: (channelId: number, content: string) => void
  getChannelMessages: (channelId: number) => UiMessage[]
  isLoading: (channelId: number) => boolean
  hasError: (channelId: number) => Error | null
  hasMore: (channelId: number) => boolean
  clearChannelMessages: (channelId: number) => void
}

const MessagesContext = createContext<MessagesContextValue | null>(null)

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(messagesReducer, initialState)
  const { send } = useWebSocket()

  // Listen for new messages
  useWebSocketSubscription(WSEventType.CHAT, (event: WebSocketEvent) => {
    try {
      if (event.type === WSEventType.CHAT && 'message' in event.payload) {
        const { message } = event.payload
        dispatch({
          type: 'ADD_MESSAGE',
          message
        })
      }
    } catch (error) {
      console.error('Error processing websocket message:', error)
    }
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.activeChannel) {
        dispatch({ type: 'CLEAR_CHANNEL_MESSAGES', channelId: state.activeChannel })
      }
    }
  }, [state.activeChannel])

  const setActiveChannel = useCallback((channelId: number) => {
    dispatch({ type: 'SET_ACTIVE_CHANNEL', channelId })
  }, [])

  const loadMessages = useCallback(async (channelId: number) => {
    dispatch({ type: 'SET_LOADING', channelId })
    
    try {
      const response = await api.channels.getMessages(channelId)
      dispatch({ 
        type: 'SET_MESSAGES', 
        channelId, 
        messages: response.messages 
      })
      dispatch({
        type: 'SET_HAS_MORE',
        channelId,
        hasMore: response.messages.length === 50 // assuming page size of 50
      })
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        channelId, 
        error: error as Error 
      })
    }
  }, [])

  const sendMessage = useCallback((channelId: number, content: string) => {
    if (!content.trim()) return

    const outgoingMessage: OutgoingChatEvent = {
      type: WSEventType.CHAT,
      payload: {
        workspaceId: 0, // This will be set by the server
        channelId,
        content: content.trim(),
        senderId: 0 // This will be set by the server
      }
    }

    send(outgoingMessage)
  }, [send])

  const getChannelMessages = useCallback((channelId: number): UiMessage[] => {
    const messageIds = state.messages.byChannel[channelId] || []
    return messageIds.map(id => state.messages.byId[id]).filter(Boolean)
  }, [state.messages])

  const isLoading = useCallback((channelId: number): boolean => {
    return !!state.messages.loadingChannels[channelId]
  }, [state.messages.loadingChannels])

  const hasError = useCallback((channelId: number): Error | null => {
    return state.messages.errors[channelId] || null
  }, [state.messages.errors])

  const hasMore = useCallback((channelId: number): boolean => {
    return !!state.messages.hasMore[channelId]
  }, [state.messages.hasMore])

  const clearChannelMessages = useCallback((channelId: number) => {
    dispatch({ type: 'CLEAR_CHANNEL_MESSAGES', channelId })
  }, [])

  const value = {
    messages: state.messages,
    activeChannel: state.activeChannel,
    setActiveChannel,
    loadMessages,
    sendMessage,
    getChannelMessages,
    isLoading,
    hasError,
    hasMore,
    clearChannelMessages
  }

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  )
}

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider')
  }
  return context
}