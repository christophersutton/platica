import { type Channel, type UiChannel } from "@models/channel"

// Helper to convert Channel to UiChannel
function toUiChannel(channel: Channel): UiChannel {
  return {
    ...channel,
    memberCount: 0,
    messageCount: 0,
    lastMessageAt: null,
    unreadCount: 0,
    unreadMentions: 0,
    memberStatus: null
  }
}

// Normalized state structure
export interface ChannelState {
  byId: Record<number, UiChannel>
  allIds: number[]
  workspaceChannels: Record<number, number[]> // workspaceId -> channelIds
  activeChannelId: number | null
  loading: {
    channels: boolean
    creating: boolean
    updating: Record<number, boolean>
  }
  errors: {
    channels: Error | null
    creating: Error | null
    updating: Record<number, Error | null>
  }
  // Typing state
  typing: {
    byChannel: Record<number, {
      userIds: number[]
      lastUpdated: Record<number, number> // userId -> timestamp
    }>
  }
}

// Action types
export type ChannelAction =
  | { type: "SET_CHANNELS_LOADING" }
  | { type: "SET_CHANNELS"; payload: { channels: Channel[]; workspaceId: number } }
  | { type: "SET_CHANNELS_ERROR"; payload: Error }
  | { type: "UPDATE_CHANNEL"; payload: Partial<Channel> & { id: number } }
  | { type: "SET_CHANNEL_UPDATING"; payload: { channelId: number; updating: boolean } }
  | { type: "SET_CHANNEL_UPDATE_ERROR"; payload: { channelId: number; error: Error | null } }
  | { type: "ADD_CHANNEL"; payload: Channel }
  | { type: "SET_CREATING_CHANNEL" }
  | { type: "SET_CREATING_CHANNEL_ERROR"; payload: Error }
  | { type: "SET_ACTIVE_CHANNEL"; payload: number | null }
  | { type: "MARK_CHANNEL_READ"; payload: number }
  | { type: "UPDATE_UNREAD_COUNT"; payload: { channelId: number; count: number } }
  | { type: "SET_USER_TYPING"; payload: { channelId: number; userId: number; isTyping: boolean } }

export function createInitialState(): ChannelState {
  return {
    byId: {},
    allIds: [],
    workspaceChannels: {},
    activeChannelId: null,
    loading: {
      channels: false,
      creating: false,
      updating: {}
    },
    errors: {
      channels: null,
      creating: null,
      updating: {}
    },
    typing: {
      byChannel: {}
    }
  }
}

export function channelReducer(state: ChannelState, action: ChannelAction): ChannelState {
  switch (action.type) {
    case "SET_CHANNELS_LOADING":
      return {
        ...state,
        loading: { ...state.loading, channels: true },
        errors: { ...state.errors, channels: null }
      }

    case "SET_CHANNELS": {
      const { channels, workspaceId } = action.payload
      console.log('SET_CHANNELS reducer:', { channels, workspaceId })
      const byId = { ...state.byId }
      const channelIds = new Set<number>()

      channels.forEach(channel => {
        byId[channel.id] = {
          ...toUiChannel(channel),
          ...byId[channel.id] // Preserve existing UI state if any
        }
        channelIds.add(channel.id)
      })

      const newState = {
        ...state,
        byId,
        allIds: [...new Set([...state.allIds, ...channelIds])],
        workspaceChannels: {
          ...state.workspaceChannels,
          [workspaceId]: Array.from(channelIds)
        },
        loading: { ...state.loading, channels: false },
        errors: { ...state.errors, channels: null }
      }
      console.log('New channel state:', newState)
      return newState
    }

    case "SET_CHANNELS_ERROR":
      return {
        ...state,
        loading: { ...state.loading, channels: false },
        errors: { ...state.errors, channels: action.payload }
      }

    case "UPDATE_CHANNEL": {
      const channel = state.byId[action.payload.id]
      if (!channel) return state

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.id]: {
            ...channel,
            ...action.payload
          }
        }
      }
    }

    case "SET_CHANNEL_UPDATING":
      return {
        ...state,
        loading: {
          ...state.loading,
          updating: {
            ...state.loading.updating,
            [action.payload.channelId]: action.payload.updating
          }
        }
      }

    case "SET_CHANNEL_UPDATE_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          updating: {
            ...state.errors.updating,
            [action.payload.channelId]: action.payload.error
          }
        }
      }

    case "ADD_CHANNEL":
      return {
        ...state,
        byId: { 
          ...state.byId, 
          [action.payload.id]: toUiChannel(action.payload)
        },
        allIds: [...state.allIds, action.payload.id],
        workspaceChannels: {
          ...state.workspaceChannels,
          [action.payload.workspaceId]: [
            ...(state.workspaceChannels[action.payload.workspaceId] || []),
            action.payload.id
          ]
        },
        loading: { ...state.loading, creating: false },
        errors: { ...state.errors, creating: null }
      }

    case "SET_CREATING_CHANNEL":
      return {
        ...state,
        loading: { ...state.loading, creating: true },
        errors: { ...state.errors, creating: null }
      }

    case "SET_CREATING_CHANNEL_ERROR":
      return {
        ...state,
        loading: { ...state.loading, creating: false },
        errors: { ...state.errors, creating: action.payload }
      }

    case "SET_ACTIVE_CHANNEL":
      return {
        ...state,
        activeChannelId: action.payload
      }

    case "MARK_CHANNEL_READ": {
      const channel = state.byId[action.payload]
      if (!channel) return state

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload]: { ...channel, unreadCount: 0 }
        }
      }
    }

    case "UPDATE_UNREAD_COUNT": {
      const channel = state.byId[action.payload.channelId]
      if (!channel) return state

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.channelId]: { 
            ...channel, 
            unreadCount: action.payload.count 
          }
        }
      }
    }

    case "SET_USER_TYPING": {
      const { channelId, userId, isTyping } = action.payload
      const now = Date.now()
      const channelTyping = state.typing.byChannel[channelId] || { userIds: [], lastUpdated: {} }

      // If user is typing, add them to the list if not already there
      // If user stopped typing, remove them from the list
      const userIds = isTyping 
        ? [...new Set([...channelTyping.userIds, userId])]
        : channelTyping.userIds.filter(id => id !== userId)

      return {
        ...state,
        typing: {
          ...state.typing,
          byChannel: {
            ...state.typing.byChannel,
            [channelId]: {
              userIds,
              lastUpdated: {
                ...channelTyping.lastUpdated,
                [userId]: now
              }
            }
          }
        }
      }
    }

    default:
      return state
  }
}