import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react"
import { api } from "@/lib/api"
import { type Channel, type UiChannel } from "@models/channel"
import { useAuth } from "../AuthContext"
import { useWebSocket } from "../websocket"
import { 
  channelReducer, 
  createInitialState, 
  type ChannelAction, 
  type ChannelState 
} from "./channelReducer"
import { WSEventType } from '@platica/shared/src/websockets'
import type { 
  ChannelCreatedEvent,
  TypingEvent
} from '@platica/shared/src/websockets'

interface ChannelContextValue {
  // State
  channels: UiChannel[]
  channelsById: Record<number, UiChannel>
  activeChannelId: number | null
  isLoadingChannels: boolean
  isCreatingChannel: boolean
  channelsError: Error | null
  creatingError: Error | null
  
  // Typing state
  typingUsers: (channelId: number) => number[]
  isUserTyping: (channelId: number, userId: number) => boolean
  setTyping: (channelId: number, isTyping: boolean) => void

  // Actions
  loadChannels: (workspaceId: number) => Promise<void>
  createChannel: (workspaceId: number, data: { 
    name: string
    description?: string
    is_private?: boolean 
  }) => Promise<void>
  markChannelAsRead: (channelId: number) => Promise<void>
  setActiveChannel: (channelId: number | null) => void
  getChannelById: (channelId: number) => UiChannel | undefined
  getWorkspaceChannels: (workspaceId: number) => UiChannel[]
}

const ChannelContext = createContext<ChannelContextValue | null>(null)

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading, user } = useAuth()
  // const { subscribe, send } = useWebSocket()
  const [state, dispatch] = useReducer(channelReducer, createInitialState())

  // Subscribe to relevant WebSocket events
  // useEffect(() => {
  //   const unsubscribeChannel = subscribe(WSEventType.CHANNEL_CREATED, (message: ChannelCreatedEvent) => {
  //     dispatch({ type: "ADD_CHANNEL", payload: message.payload.channel })
  //   })

  //   const unsubscribeTyping = subscribe(WSEventType.TYPING, (message: TypingEvent) => {
  //     dispatch({ 
  //       type: "SET_USER_TYPING", 
  //       payload: {
  //         channelId: message.payload.channelId,
  //         userId: message.payload.userId,
  //         isTyping: message.payload.isTyping
  //       }
  //     })
  //   })

  //   return () => {
  //     unsubscribeChannel()
  //     unsubscribeTyping()
  //   }
  // }, [subscribe])

  // Clean up stale typing indicators
  useEffect(() => {
    const TYPING_TIMEOUT = 3000 // 3 seconds
    const interval = setInterval(() => {
      const now = Date.now()
      Object.entries(state.typing.byChannel).forEach(([channelId, channelTyping]) => {
        const staleUsers = channelTyping.userIds.filter(userId => {
          const lastUpdate = channelTyping.lastUpdated[userId]
          return now - lastUpdate > TYPING_TIMEOUT
        })
        
        staleUsers.forEach(userId => {
          dispatch({
            type: "SET_USER_TYPING",
            payload: {
              channelId: Number(channelId),
              userId,
              isTyping: false
            }
          })
        })
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state.typing.byChannel])

  const loadChannels = useCallback(async (workspaceId: number) => {
    console.log('Loading channels for workspace:', workspaceId)
    if (!token || isAuthLoading) {
      console.log('Skipping channel load - no token or auth loading:', { token: !!token, isAuthLoading })
      return
    }
    dispatch({ type: "SET_CHANNELS_LOADING" })
    try {
      console.log('Fetching channels...')
      const res = await api.channels.list(workspaceId)
      console.log('Channels response:', res)
      dispatch({ 
        type: "SET_CHANNELS", 
        payload: { 
          channels: res.channels,
          workspaceId 
        } 
      })
      console.log('Channels dispatched to store')
    } catch (error) {
      console.error("Failed to fetch channels:", error)
      dispatch({ type: "SET_CHANNELS_ERROR", payload: error as Error })
    }
  }, [token, isAuthLoading])

  const createChannel = useCallback(async (
    workspaceId: number, 
    data: { name: string; description?: string; is_private?: boolean }
  ) => {
    if (!token || isAuthLoading) return
    dispatch({ type: "SET_CREATING_CHANNEL" })
    try {
      const response = await api.channels.create(workspaceId, data)
      dispatch({ type: "ADD_CHANNEL", payload: response.channel })
    } catch (error) {
      console.error("Failed to create channel:", error)
      dispatch({ type: "SET_CREATING_CHANNEL_ERROR", payload: error as Error })
    }
  }, [token, isAuthLoading])

  const markChannelAsRead = useCallback(async (channelId: number) => {
    if (!token || isAuthLoading) return
    try {
      await api.channels.markAsRead(channelId)
      dispatch({ type: "MARK_CHANNEL_READ", payload: channelId })
    } catch (error) {
      console.error("Failed to mark channel as read:", error)
    }
  }, [token, isAuthLoading])

  const setActiveChannel = useCallback((channelId: number | null) => {
    dispatch({ type: "SET_ACTIVE_CHANNEL", payload: channelId })
  }, [])

  const getChannelById = useCallback((channelId: number) => {
    return state.byId[channelId]
  }, [state.byId])

  const getWorkspaceChannels = useCallback((workspaceId: number): UiChannel[] => {
    const channelIds = state.workspaceChannels[workspaceId] || []
    return channelIds
      .map(id => state.byId[id])
      .filter((channel): channel is UiChannel => channel !== undefined)
  }, [state.workspaceChannels, state.byId])

  const typingUsers = useCallback((channelId: number) => {
    return state.typing.byChannel[channelId]?.userIds || []
  }, [state.typing.byChannel])

  const isUserTyping = useCallback((channelId: number, userId: number) => {
    return state.typing.byChannel[channelId]?.userIds.includes(userId) || false
  }, [state.typing.byChannel])

  // const setTyping = useCallback((channelId: number, isTyping: boolean) => {
  //   if (!user) return

  //   dispatch({
  //     type: "SET_USER_TYPING",
  //     payload: {
  //       channelId,
  //       userId: user.id,
  //       isTyping
  //     }
  //   })

  //   send({
  //     type: WSEventType.TYPING,
  //     payload: {
  //       channelId,
  //       userId: user.id,
  //       isTyping
  //     }
  //   })
  // }, [user, send])

  const value = {
    // Computed properties for API compatibility
    channels: state.allIds.map(id => state.byId[id]),
    channelsById: state.byId,
    activeChannelId: state.activeChannelId,
    isLoadingChannels: state.loading.channels,
    isCreatingChannel: state.loading.creating,
    channelsError: state.errors.channels,
    creatingError: state.errors.creating,

    // Typing state
    typingUsers,
    isUserTyping,
    setTyping: (()=> null) ,

    // Actions
    loadChannels,
    createChannel,
    markChannelAsRead,
    setActiveChannel,
    getChannelById,
    getWorkspaceChannels,
  }

  console.log('Channel context state:', {
    allIds: state.allIds,
    byId: state.byId,
    workspaceChannels: state.workspaceChannels,
    computedChannels: value.channels,
    loading: state.loading
  })

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>
}

export function useChannels() {
  const ctx = useContext(ChannelContext)
  if (!ctx) throw new Error("useChannels must be used within ChannelProvider")
  return ctx
}