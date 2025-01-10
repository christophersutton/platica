import React, { createContext, useContext, useCallback, useReducer } from 'react'
import { useWebSocket, useWebSocketSubscription } from './WebSocketContext'
import { api } from '@/lib/api'
import { WSEventType } from '@platica/shared/src/websockets'
import type { Message } from '@platica/shared/src/types'
import { ensureUnixTimestamp } from '@platica/shared/src/utils/time'

// Normalized message store type
interface NormalizedMessages {
  byId: Record<number, Message>
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
        // Ensure timestamps are in Unix timestamp format
        newById[msg.id] = {
          ...msg,
          created_at: ensureUnixTimestamp(msg.created_at),
          updated_at: ensureUnixTimestamp(msg.updated_at),
          deleted_at: msg.deleted_at ? ensureUnixTimestamp(msg.deleted_at) : null
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
      const channelId = action.message.channel_id
      const channelMessages = state.messages.byChannel[channelId] || []
      
      // Check for duplicates
      if (channelMessages.includes(action.message.id)) {
        return state
      }

      // Ensure timestamps are in Unix timestamp format
      const messageWithFixedTimestamps = {
        ...action.message,
        created_at: ensureUnixTimestamp(action.message.created_at),
        updated_at: ensureUnixTimestamp(action.message.updated_at),
        deleted_at: action.message.deleted_at ? ensureUnixTimestamp(action.message.deleted_at) : null
      }

      return {
        ...state,
        messages: {
          ...state.messages,
          byId: {
            ...state.messages.byId,
            [action.message.id]: messageWithFixedTimestamps
          },
          byChannel: {
            ...state.messages.byChannel,
            [channelId]: [...channelMessages, action.message.id]
          }
        }
      }
    }

    case 'UPDATE_MESSAGE': {
      const updates = { ...action.updates }
      
      // Ensure any timestamp updates are in Unix timestamp format
      if ('created_at' in updates) {
        updates.created_at = ensureUnixTimestamp(updates.created_at)
      }
      if ('updated_at' in updates) {
        updates.updated_at = ensureUnixTimestamp(updates.updated_at)
      }
      if ('deleted_at' in updates) {
        updates.deleted_at = updates.deleted_at ? ensureUnixTimestamp(updates.deleted_at) : null
      }

      return {
        ...state,
        messages: {
          ...state.messages,
          byId: {
            ...state.messages.byId,
            [action.messageId]: {
              ...state.messages.byId[action.messageId],
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

    default:
      return state
  }
}

interface MessagesContextValue {
  messages: NormalizedMessages
  activeChannel: number | null
  setActiveChannel: (channelId: number) => void
  loadMessages: (channelId: number, before?: number) => Promise<void>
  sendMessage: (channelId: number, content: string) => void
  getChannelMessages: (channelId: number) => Message[]
  isLoading: (channelId: number) => boolean
  hasError: (channelId: number) => Error | null
  hasMore: (channelId: number) => boolean
}

const MessagesContext = createContext<MessagesContextValue | null>(null)

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(messagesReducer, initialState)
  const { send } = useWebSocket()

  // Listen for new messages
  useWebSocketSubscription(WSEventType.CHAT, (message) => {
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: message.messageId,
        content: message.content,
        channel_id: message.channelId,
        sender_id: message.userId,
        sender_name: message.sender_name,
        created_at: ensureUnixTimestamp(message.createdAt),
        updated_at: ensureUnixTimestamp(message.createdAt), // Same as created initially
        deleted_at: null,
        thread_id: message.threadId,
        avatar_url: message.avatar_url || null
      }
    })
  })

  const setActiveChannel = useCallback((channelId: number) => {
    dispatch({ type: 'SET_ACTIVE_CHANNEL', channelId })
  }, [])

  const loadMessages = useCallback(async (channelId: number, before?: number) => {
    dispatch({ type: 'SET_LOADING', channelId })
    
    try {
      const response = await api.channels.getMessages(channelId, { before })
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

    send({
      type: WSEventType.CHAT,
      channelId,
      content,
      userId: 0, // This will be set by the server
    })
  }, [send])

  const getChannelMessages = useCallback((channelId: number): Message[] => {
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

  const value = {
    messages: state.messages,
    activeChannel: state.activeChannel,
    setActiveChannel,
    loadMessages,
    sendMessage,
    getChannelMessages,
    isLoading,
    hasError,
    hasMore
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