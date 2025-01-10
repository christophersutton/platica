// AppContext.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useRef,
    useCallback,
    useState,
  } from "react"
  import { useAuth } from "./AuthContext"
  import { api } from "@/lib/api"
  import { WSEventType } from '@platica/shared/src/websockets'
  import type { 
    WebSocketEvent,
    ChatEvent,
    OutgoingChatEvent,
    TypingEvent,
    PresenceEvent,
    PresenceSyncEvent,
    ChannelCreatedEvent,
    ErrorEvent 
  } from '@platica/shared/src/websockets'
  import type { Message, MessageWithClientState, CreateMessageDTO } from '@models/message'
  import type { Channel } from '@models/channel'
  import type { Workspace } from '@models/workspace'
  import type { User } from '@models/user'
  import type { ApiResponse } from '@platica/shared/src/api/types'
  
  /**
   * Presence map for tracking user online status
   */
  interface UserPresence {
    [userId: User['id']]: {
      status: "online" | "offline"
      lastUpdate: number
    }
  }
  
  /**
   * The shape of our entire app's "non-auth" state
   */
  interface AppState {
    workspace: Workspace | null
    isLoadingWorkspace: boolean
    workspaceError: Error | null
  
    channels: Channel[]
    isLoadingChannels: boolean
    channelsError: Error | null
  
    // We'll store messages keyed by channelId
    messages: Record<Channel['id'], MessageWithClientState[]>
    isLoadingMessages: boolean
    messagesError: Error | null
  
    presenceMap: UserPresence
  
    // Who is typing in each channel
    typingMap: Record<Channel['id'], User['id'][]> // channelId -> array of userIds
  
    // Mobile check
    isMobile: boolean
  
    // Websocket connection status
    isWsConnected: boolean
    wsStatus: 'connecting' | 'connected' | 'disconnected'
  }
  
  /**
   * Define the actions that replicate each original hook's behavior
   */
  type ChannelUpdate = Partial<Channel> & { id: Channel['id'] }
  
  type AppAction =
    | { type: "SET_WORKSPACE_LOADING" }
    | { type: "SET_WORKSPACE"; payload: Workspace }
    | { type: "SET_WORKSPACE_ERROR"; payload: Error }
    | { type: "SET_CHANNELS_LOADING" }
    | { type: "SET_CHANNELS"; payload: Channel[] }
    | { type: "SET_CHANNELS_ERROR"; payload: Error }
    | { type: "SET_MESSAGES_LOADING" }
    | { type: "SET_MESSAGES"; payload: { channelId: Channel['id']; messages: MessageWithClientState[] } }
    | { type: "SET_MESSAGES_ERROR"; payload: Error }
    | { type: "ADD_MESSAGE"; payload: { channelId: Channel['id']; message: MessageWithClientState } }
    | { type: "MARK_CHANNEL_READ"; payload: Channel['id'] } // channelId
    | { type: "UPDATE_CHANNEL"; payload: ChannelUpdate }
    | { type: "SET_PRESENCE"; payload: { userId: User['id']; status: "online" | "offline" } }
    | { type: "SET_PRESENCE_SYNC"; payload: User['id'][] } // onlineUsers
    | { type: "CLEAR_TYPING"; payload: { channelId: Channel['id']; userId: User['id'] } }
    | { type: "ADD_TYPING"; payload: { channelId: Channel['id']; userId: User['id'] } }
    | { type: "REMOVE_TYPING"; payload: { channelId: Channel['id']; userId: User['id'] } }
    | { type: "SET_IS_MOBILE"; payload: boolean }
    | { type: "SET_WS_CONNECTED"; payload: boolean }
    | { type: "SET_WS_STATUS"; payload: 'connecting' | 'connected' | 'disconnected' }
  
  function createInitialState(): AppState {
    return {
      workspace: null,
      isLoadingWorkspace: false,
      workspaceError: null,
  
      channels: [],
      isLoadingChannels: false,
      channelsError: null,
  
      messages: {},
      isLoadingMessages: false,
      messagesError: null,
  
      presenceMap: {},
      typingMap: {},
  
      isMobile: false,
      isWsConnected: false,
      wsStatus: 'disconnected',
    }
  }

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
      case "SET_WORKSPACE_LOADING":
        return { ...state, isLoadingWorkspace: true, workspaceError: null }
      case "SET_WORKSPACE":
        return {
          ...state,
          workspace: action.payload,
          isLoadingWorkspace: false,
          workspaceError: null,
        }
      case "SET_WORKSPACE_ERROR":
        return {
          ...state,
          workspaceError: action.payload,
          isLoadingWorkspace: false,
        }
      case "SET_CHANNELS_LOADING":
        return { ...state, isLoadingChannels: true, channelsError: null }
      case "SET_CHANNELS":
        return {
          ...state,
          channels: action.payload,
          isLoadingChannels: false,
          channelsError: null,
        }
      case "SET_CHANNELS_ERROR":
        return {
          ...state,
          channelsError: action.payload,
          isLoadingChannels: false,
        }
      case "SET_MESSAGES_LOADING":
        return { ...state, isLoadingMessages: true, messagesError: null }
      case "SET_MESSAGES":
        return {
          ...state,
          messages: {
            ...state.messages,
            [action.payload.channelId]: action.payload.messages,
          },
          isLoadingMessages: false,
          messagesError: null,
        }
      case "SET_MESSAGES_ERROR":
        return {
          ...state,
          messagesError: action.payload,
          isLoadingMessages: false,
        }
      case "ADD_MESSAGE": {
        const { channelId, message } = action.payload
        const existing = state.messages[channelId] || []
        return {
          ...state,
          messages: {
            ...state.messages,
            [channelId]: [...existing, message],
          },
        }
      }
      case "MARK_CHANNEL_READ": {
        // You might want to mark channel as read in the state
        const channelId = action.payload
        return {
          ...state,
          channels: state.channels.map((c) =>
            c.id === channelId ? { ...c, unreadCount: 0 } : c
          ),
        }
      }
      case "UPDATE_CHANNEL": {
        const update = action.payload
        return {
          ...state,
          channels: state.channels.map((c) =>
            c.id === update.id ? { ...c, ...update } : c
          ),
        }
      }
      case "SET_PRESENCE": {
        const { userId, status } = action.payload
        const now = Date.now()
        return {
          ...state,
          presenceMap: {
            ...state.presenceMap,
            [userId]: { status, lastUpdate: now },
          },
        }
      }
      case "SET_PRESENCE_SYNC": {
        // Mark all presence as offline, then set these userIds to online
        const now = Date.now()
        const newPresence: UserPresence = {}
        // Copy existing presence so we don't lose lastUpdate for users not in the sync
        Object.keys(state.presenceMap).forEach((uid) => {
          newPresence[Number(uid)] = {
            status: "offline",
            lastUpdate: now,
          }
        })
        action.payload.forEach((uid) => {
          newPresence[uid] = { status: "online", lastUpdate: now }
        })
        return { ...state, presenceMap: newPresence }
      }
      case "CLEAR_TYPING": {
        const { channelId, userId } = action.payload
        const current = state.typingMap[channelId] || []
        return {
          ...state,
          typingMap: {
            ...state.typingMap,
            [channelId]: current.filter((id) => id !== userId),
          },
        }
      }
      case "ADD_TYPING": {
        const { channelId, userId } = action.payload
        const current = state.typingMap[channelId] || []
        if (current.includes(userId)) {
          return state // already present
        }
        return {
          ...state,
          typingMap: {
            ...state.typingMap,
            [channelId]: [...current, userId],
          },
        }
      }
      case "REMOVE_TYPING": {
        const { channelId, userId } = action.payload
        const current = state.typingMap[channelId] || []
        return {
          ...state,
          typingMap: {
            ...state.typingMap,
            [channelId]: current.filter((id) => id !== userId),
          },
        }
      }
      case "SET_IS_MOBILE":
        return { ...state, isMobile: action.payload }
      case "SET_WS_CONNECTED":
        return { ...state, isWsConnected: action.payload }
      case "SET_WS_STATUS":
        return { ...state, wsStatus: action.payload }
      default:
        return state
    }
  }

const AppContext = createContext<{
    state: AppState
    loadWorkspace: (id: number) => Promise<void>
    loadChannels: (workspaceId: number) => Promise<void>
    loadMessages: (channelId: number) => Promise<void>
    sendMessage: (channelId: number, content: string) => Promise<void>
    markChannelAsRead: (channelId: number) => Promise<void>
    createChannel: (workspaceId: number, data: { name: string; description?: string; is_private?: boolean }) => Promise<void>
    sendTypingIndicator: (channelId: number) => void
    clearTypingIndicator: (channelId: number) => void
    // ... plus anything else from your hooks
  } | null>(null)
  
  export function AppProvider({ children }: { children: React.ReactNode }) {
    const { user, token, isLoading: isAuthLoading } = useAuth()
    const [state, dispatch] = useReducer(appReducer, createInitialState())
  
    // -------------------------------
    // (A) "useIsMobile" replacement
    // -------------------------------
    useEffect(() => {
      const MOBILE_BREAKPOINT = 768
      function checkSize() {
        dispatch({ type: "SET_IS_MOBILE", payload: window.innerWidth < MOBILE_BREAKPOINT })
      }
      window.addEventListener("resize", checkSize)
      checkSize()
      return () => window.removeEventListener("resize", checkSize)
    }, [])
  
    // -------------------------------
    // (B) "useWorkspace" replacement
    // -------------------------------
    const loadWorkspace = useCallback(async (workspaceId: number) => {
      if (!token || isAuthLoading) return
      dispatch({ type: "SET_WORKSPACE_LOADING" })
      try {
        const ws = await api.workspaces.get(workspaceId)
        dispatch({ type: "SET_WORKSPACE", payload: ws })
      } catch (error) {
        dispatch({ type: "SET_WORKSPACE_ERROR", payload: error as Error })
      }
    }, [token, isAuthLoading])
  
    // -------------------------------
    // (C) "useChannels" replacement
    // -------------------------------
    const loadChannels = useCallback(async (workspaceId: number) => {
      if (!token || isAuthLoading) return
      dispatch({ type: "SET_CHANNELS_LOADING" })
      try {
        const res = await api.channels.list(workspaceId)
        dispatch({ type: "SET_CHANNELS", payload: res.channels })
      } catch (error) {
        console.error("Failed to fetch channels:", error)
        dispatch({ type: "SET_CHANNELS_ERROR", payload: error as Error })
      }
    }, [token, isAuthLoading])
  
    const createChannel = useCallback(async (workspaceId: number, data: { name: string; description?: string; is_private?: boolean }) => {
      if (!token || isAuthLoading) return
      try {
        const response = await api.channels.create(workspaceId, data)
        // invalidate or update channels
        dispatch({ type: "SET_CHANNELS", payload: [...state.channels, response.channel] })
      } catch (error) {
        console.error("Failed to create channel:", error)
      }
    }, [state.channels, token, isAuthLoading])
  
    // -------------------------------
    // (D) "useChannelMessages" replacement
    // -------------------------------
    const loadMessages = useCallback(async (channelId: number) => {
      if (!token || isAuthLoading) return
      dispatch({ type: "SET_MESSAGES_LOADING" })
      try {
        const res = await api.channels.getMessages(channelId)
        // Convert API messages to client messages
        const messages = res.messages.map(m => ({
          ...m,
          isSending: false,
          hasFailed: false
        } as MessageWithClientState))
        dispatch({ type: "SET_MESSAGES", payload: { channelId, messages } })
      } catch (error) {
        console.error("Failed to load messages:", error)
        dispatch({ type: "SET_MESSAGES_ERROR", payload: error as Error })
      }
    }, [token, isAuthLoading])
  
    // Mark channel as read
    const markChannelAsRead = useCallback(async (channelId: number) => {
      if (!token || isAuthLoading) return
      try {
        await api.channels.markAsRead(channelId)
        dispatch({ type: "MARK_CHANNEL_READ", payload: channelId })
      } catch (error) {
        console.error("Failed to mark channel as read:", error)
      }
    }, [token, isAuthLoading])
  
    // Send message via WebSocket
    const sendMessage = useCallback(async (channelId: number, content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not ready, cannot send message')
        return
      }
      
      if (!user?.id || !state.workspace?.id) return
      
      const outgoingEvent: OutgoingChatEvent = {
        type: WSEventType.CHAT,
        payload: {
          workspaceId: state.workspace.id,
          channelId,
          senderId: user.id,
          content
        }
      }
      wsRef.current.send(JSON.stringify(outgoingEvent))
    }, [user, state.workspace?.id])
  
    // -------------------------------
    // (E) "usePresence" & "useTypingIndicator" & "useWebSocket"
    // -------------------------------
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const maxReconnectAttempts = 5
    const isConnectingRef = useRef(false)
    const reconnectTimeoutRef = useRef<number>()
  
    // Create a stable message handler using useCallback
    const handleWebSocketMessage = useCallback((event: MessageEvent) => {
      try {
        const wsEvent = JSON.parse(event.data) as WebSocketEvent
        switch (wsEvent.type) {
          case WSEventType.ERROR: {
            console.error("WebSocket error:", wsEvent.payload.message)
            if (wsEvent.payload.code === 'auth_failed') {
              wsRef.current?.close()
            }
            break
          }
          case WSEventType.CHAT: {
            const { message } = (wsEvent as ChatEvent).payload
            console.debug('Received message:', message.id)
            
            const existingMessages = state.messages[message.channelId] || []
            const messageExists = existingMessages.some(m => m.id === message.id)

            if (!messageExists) {
              console.debug('Adding new message:', message.id)
              const newMsg: MessageWithClientState = {
                ...message,
                isSending: false,
                hasFailed: false
              }
              dispatch({ type: "ADD_MESSAGE", payload: { channelId: message.channelId, message: newMsg } })
              
              // Update channel unread status
              if (message.sender.id !== user?.id) {
                const channel = state.channels.find(c => c.id === message.channelId)
                dispatch({
                  type: "UPDATE_CHANNEL",
                  payload: { 
                    id: message.channelId,
                    hasUnread: (channel?.hasUnread || 0) + 1
                  }
                })
              }
            } else {
              console.debug('Duplicate message detected, ignoring:', message.id)
            }
            break
          }
          case WSEventType.PRESENCE: {
            const { userId, status } = wsEvent.payload
            dispatch({ type: "SET_PRESENCE", payload: { userId, status } })
            break
          }
          case WSEventType.PRESENCE_SYNC: {
            const { onlineUsers } = wsEvent.payload
            dispatch({ type: "SET_PRESENCE_SYNC", payload: onlineUsers })
            break
          }
          case WSEventType.TYPING: {
            const { channelId, userId, isTyping } = wsEvent.payload
            if (isTyping) {
              dispatch({ type: "ADD_TYPING", payload: { channelId, userId } })
            } else {
              dispatch({ type: "REMOVE_TYPING", payload: { channelId, userId } })
            }
            break
          }
          case WSEventType.CHANNEL_CREATED: {
            const { channel } = wsEvent.payload
            dispatch({ type: "SET_CHANNELS", payload: [...state.channels, channel] })
            break
          }
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err)
      }
    }, [state.messages, state.channels, user?.id])
  
    // Store the handler in a ref to avoid recreating the WebSocket connection
    const messageHandlerRef = useRef(handleWebSocketMessage);
    useEffect(() => {
      messageHandlerRef.current = handleWebSocketMessage;
    }, [handleWebSocketMessage]);
  
    const connectWebSocket = useCallback(() => {
      if (!user || !token || !state.workspace?.id || isAuthLoading) {
        return;
      }

      // Close any existing connection first
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error("Max WebSocket reconnection attempts reached.");
        return;
      }

      dispatch({ type: "SET_WS_STATUS", payload: 'connecting' });

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port = "3001";
      const wsUrl = `${protocol}//${host}:${port}?workspace_id=${state.workspace.id}&user_id=${user.id}`;
      console.log("WebSocket: connecting to", wsUrl);

      try {
        isConnectingRef.current = true;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.error("WebSocket connection timeout");
            ws.close();
            dispatch({ type: "SET_WS_STATUS", payload: 'disconnected' });
          }
        }, 3000);

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          isConnectingRef.current = false;
          reconnectAttemptsRef.current = 0;
          dispatch({ type: "SET_WS_CONNECTED", payload: true });
          dispatch({ type: "SET_WS_STATUS", payload: 'connected' });
          ws.send(JSON.stringify({ type: "auth", token: `Bearer ${token}` }));
          console.log("WebSocket connected!");
        };

        ws.onmessage = (event) => messageHandlerRef.current(event);

        ws.onclose = (evt) => {
          console.warn("WebSocket closed:", evt.code, evt.reason)
          wsRef.current = null
          dispatch({ type: "SET_WS_CONNECTED", payload: false })
          dispatch({ type: "SET_WS_STATUS", payload: 'disconnected' })
          isConnectingRef.current = false
          clearTimeout(connectionTimeout)
  
          // Attempt reconnection if not a normal code
          if (evt.code !== 1000 && evt.code !== 1001) {
            reconnectAttemptsRef.current++
            const backoff = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000)
            console.log("Scheduling reconnect in", backoff, "ms")
            reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, backoff)
          }
        }
  
        ws.onerror = (err) => {
          console.error("WebSocket error:", err)
          isConnectingRef.current = false
          dispatch({ type: "SET_WS_CONNECTED", payload: false })
        }
      } catch (err) {
        console.error("Failed to create WebSocket:", err)
        isConnectingRef.current = false
        dispatch({ type: "SET_WS_CONNECTED", payload: false })
        dispatch({ type: "SET_WS_STATUS", payload: 'disconnected' })
      }
    }, [user, token, state.workspace?.id, isAuthLoading, dispatch]);
  
    // On mount/unmount
    useEffect(() => {
      connectWebSocket()
      return () => {
        if (wsRef.current) {
          wsRef.current.close()
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
      }
    }, [connectWebSocket])
  
    // (F) Typing indicator
    const sendTypingIndicator = useCallback((channelId: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return; // Silently fail for typing indicators
      }
      
      if (!user?.id) return;
      
      const message: TypingEvent = {
        type: WSEventType.TYPING,
        payload: {
          channelId,
          userId: user.id,
          isTyping: true,
        }
      }
      wsRef.current.send(JSON.stringify(message));
    }, [user]);
  
    const clearTypingIndicator = useCallback((channelId: number) => {
      if (!user?.id || !wsRef.current) return
      const message: TypingEvent = {
        type: WSEventType.TYPING,
        payload: {
          channelId,
          userId: user.id,
          isTyping: false,
        }
      }
      wsRef.current.send(JSON.stringify(message))
    }, [user])
  
    // Periodic effect to remove stale typing indicators (similar to use-typing-indicator’s setInterval).
    useEffect(() => {
      const interval = setInterval(() => {
        // If needed, remove typing after 2 seconds
        // We'll keep it simpler: the server approach from your code already does some cleanup
        // If you want local cleanup, do it here
      }, 500)
      return () => clearInterval(interval)
    }, [])
  
    const value = {
      state,
      loadWorkspace,
      loadChannels,
      loadMessages,
      markChannelAsRead,
      createChannel,
      sendMessage,
      sendTypingIndicator,
      clearTypingIndicator,
    }
  
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
  }
  
  export function useAppContext() {
    const ctx = useContext(AppContext)
    if (!ctx) throw new Error("useAppContext must be inside <AppProvider>")
    return ctx
  }