import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
} from "react"
import { useAuth } from "./AuthContext"
import { api, type Workspace } from "@/lib/api"

type PresenceMessage = {
  type: "presence"
  userId: number
  status?: "online" | "offline"
}

type PresenceSyncMessage = {
  type: "presence_sync"
  onlineUsers: number[]
}

type WebSocketMessage = PresenceMessage | PresenceSyncMessage

interface UserPresence {
  [userId: number]: {
    status: "online" | "offline"
    lastUpdate: number
  }
}

interface AppState {
  workspace: Workspace | null
  isLoadingWorkspace: boolean
  workspaceError: Error | null
  presenceMap: UserPresence
  isMobile: boolean
  isWsConnected: boolean
  wsStatus: 'connecting' | 'connected' | 'disconnected'
}

type AppAction =
  | { type: "SET_WORKSPACE_LOADING" }
  | { type: "SET_WORKSPACE"; payload: Workspace }
  | { type: "SET_WORKSPACE_ERROR"; payload: Error }
  | { type: "SET_PRESENCE"; payload: { userId: number; status: "online" | "offline" } }
  | { type: "SET_PRESENCE_SYNC"; payload: number[] }
  | { type: "SET_IS_MOBILE"; payload: boolean }
  | { type: "SET_WS_CONNECTED"; payload: boolean }
  | { type: "SET_WS_STATUS"; payload: 'connecting' | 'connected' | 'disconnected' }

function createInitialState(): AppState {
  return {
    workspace: null,
    isLoadingWorkspace: false,
    workspaceError: null,
    presenceMap: {},
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
      const now = Date.now()
      const newPresence: UserPresence = {}
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
} | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading } = useAuth()
  const [state, dispatch] = useReducer(appReducer, createInitialState())

  // Mobile detection
  useEffect(() => {
    const MOBILE_BREAKPOINT = 768
    function checkSize() {
      dispatch({ type: "SET_IS_MOBILE", payload: window.innerWidth < MOBILE_BREAKPOINT })
    }
    window.addEventListener("resize", checkSize)
    checkSize()
    return () => window.removeEventListener("resize", checkSize)
  }, [])

  // Workspace loading
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

  const value = {
    state,
    loadWorkspace,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppContext must be inside <AppProvider>")
  return ctx
}