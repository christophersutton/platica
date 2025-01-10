import type { ApiMessage, Message, UiMessage } from '@models/message'
import { validateTimestamp } from '@types'
import { TimestampError } from '@platica/shared/src/utils/time'

interface MessageState {
  byId: Record<number, UiMessage>
  channelMessages: Record<number, number[]>
  loading: {
    channels: Record<number, boolean>
    sending: boolean
  }
  errors: {
    channels: Record<number, Error | null>
    sending: Error | null
  }
  pagination: {
    hasMore: Record<number, boolean>
    lastMessageId: Record<number, number | null>
  }
  activeChannelId: number | null
}

// Helper to validate message timestamps
function validateMessageTimestamps(message: ApiMessage | Message): boolean {
  try {
    validateTimestamp(message.createdAt);
    validateTimestamp(message.updatedAt);
    if (message.deletedAt !== null) {
      validateTimestamp(message.deletedAt);
    }
    return true;
  } catch (error) {
    if (error instanceof TimestampError) {
      console.error('Invalid timestamp in message:', error.message);
      return false;
    }
    throw error; // Re-throw unexpected errors
  }
}

// Helper to safely process a message
function processMessage(message: ApiMessage | Message): UiMessage {
  const baseMessage = message as ApiMessage; // ApiMessage has all the fields we need
  
  try {
    return {
      ...baseMessage,
      // Validate timestamps, fallback to current time if invalid
      createdAt: validateTimestamp(baseMessage.createdAt),
      updatedAt: validateTimestamp(baseMessage.updatedAt),
      deletedAt: baseMessage.deletedAt ? validateTimestamp(baseMessage.deletedAt) : null,
      // Ensure required UiMessage fields are present
      reactionCount: 'reactionCount' in baseMessage ? baseMessage.reactionCount : 0,
      replyCount: 'replyCount' in baseMessage ? baseMessage.replyCount : 0,
      hasThread: 'hasThread' in baseMessage ? baseMessage.hasThread : false,
      // UI specific fields
      isSending: false,
      hasFailed: false,
      optimistic: false,
      isHighlighted: false,
      isPending: false,
      isDeleting: false,
      showEditForm: false
    };
  } catch (error) {
    if (error instanceof TimestampError) {
      console.error('Invalid timestamp, using current time:', error.message);
      const now = validateTimestamp(Math.floor(Date.now() / 1000));
      return {
        ...baseMessage,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        reactionCount: 'reactionCount' in baseMessage ? baseMessage.reactionCount : 0,
        replyCount: 'replyCount' in baseMessage ? baseMessage.replyCount : 0,
        hasThread: 'hasThread' in baseMessage ? baseMessage.hasThread : false,
        isSending: false,
        hasFailed: false,
        optimistic: false,
        isHighlighted: false,
        isPending: false,
        isDeleting: false,
        showEditForm: false
      };
    }
    throw error; // Re-throw unexpected errors
  }
}

export type MessageAction =
  | { type: 'SET_ACTIVE_CHANNEL'; payload: number | null }
  | { type: 'SET_CHANNEL_LOADING'; payload: { channelId: number } }
  | { type: 'SET_SENDING_MESSAGE' }
  | { type: 'SET_CHANNEL_ERROR'; payload: { channelId: number; error: Error } }
  | { type: 'SET_SENDING_ERROR'; payload: Error }
  | { type: 'SET_CHANNEL_MESSAGES'; payload: { channelId: number; messages: ApiMessage[] } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: number; updates: Partial<UiMessage> } }
  | { type: 'SET_PAGINATION'; payload: { channelId: number; hasMore: boolean; lastMessageId: number | null } }

export function createInitialState(): MessageState {
  return {
    byId: {},
    channelMessages: {},
    loading: {
      channels: {},
      sending: false
    },
    errors: {
      channels: {},
      sending: null
    },
    pagination: {
      hasMore: {},
      lastMessageId: {}
    },
    activeChannelId: null
  }
}

export function messageReducer(state: MessageState, action: MessageAction): MessageState {
  switch (action.type) {
    case 'SET_ACTIVE_CHANNEL':
      return {
        ...state,
        activeChannelId: action.payload
      }

    case 'SET_CHANNEL_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          channels: {
            ...state.loading.channels,
            [action.payload.channelId]: true
          }
        },
        errors: {
          ...state.errors,
          channels: {
            ...state.errors.channels,
            [action.payload.channelId]: null
          }
        }
      }

    case 'SET_SENDING_MESSAGE':
      return {
        ...state,
        loading: {
          ...state.loading,
          sending: true
        },
        errors: {
          ...state.errors,
          sending: null
        }
      }

    case 'SET_CHANNEL_ERROR':
      return {
        ...state,
        loading: {
          ...state.loading,
          channels: {
            ...state.loading.channels,
            [action.payload.channelId]: false
          }
        },
        errors: {
          ...state.errors,
          channels: {
            ...state.errors.channels,
            [action.payload.channelId]: action.payload.error
          }
        }
      }

    case 'SET_SENDING_ERROR':
      return {
        ...state,
        loading: {
          ...state.loading,
          sending: false
        },
        errors: {
          ...state.errors,
          sending: action.payload
        }
      }

    case 'SET_CHANNEL_MESSAGES': {
      const { channelId, messages } = action.payload
      const newById = { ...state.byId }
      const messageIds: number[] = []

      messages.forEach(msg => {
        // Skip messages with invalid timestamps
        if (!validateMessageTimestamps(msg)) {
          console.warn('Skipping message with invalid timestamps:', msg.id);
          return;
        }
        
        newById[msg.id] = processMessage(msg)
        messageIds.push(msg.id)
      })

      return {
        ...state,
        byId: newById,
        channelMessages: {
          ...state.channelMessages,
          [channelId]: messageIds
        },
        loading: {
          ...state.loading,
          channels: {
            ...state.loading.channels,
            [channelId]: false
          }
        }
      }
    }

    case 'ADD_MESSAGE': {
      const message = action.payload
      const channelId = message.channelId
      const channelMessages = state.channelMessages[channelId] || []
      
      // Check for duplicates
      if (channelMessages.includes(message.id)) {
        return state
      }

      // Skip messages with invalid timestamps
      if (!validateMessageTimestamps(message)) {
        console.warn('Skipping message with invalid timestamps:', message.id);
        return state;
      }

      return {
        ...state,
        byId: {
          ...state.byId,
          [message.id]: processMessage(message)
        },
        channelMessages: {
          ...state.channelMessages,
          [channelId]: [...channelMessages, message.id]
        }
      }
    }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.messageId]: {
            ...state.byId[action.payload.messageId],
            ...action.payload.updates
          }
        }
      }

    case 'SET_PAGINATION':
      return {
        ...state,
        pagination: {
          ...state.pagination,
          hasMore: {
            ...state.pagination.hasMore,
            [action.payload.channelId]: action.payload.hasMore
          },
          lastMessageId: {
            ...state.pagination.lastMessageId,
            [action.payload.channelId]: action.payload.lastMessageId
          }
        }
      }

    default:
      return state
  }
}