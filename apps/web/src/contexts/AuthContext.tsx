import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useReducer,
  } from "react"
  import { api, type User } from "@/lib/api"
  
  interface AuthState {
    user: User | null
    token: string | null
    isLoading: boolean
    isInitialized: boolean
    error: Error | null
  }
  
  type AuthAction =
    | { type: "INIT" } // set isLoading
    | {
        type: "SET_USER"
        payload: { user: User; token: string }
      }
    | { type: "CLEAR_USER" }
    | { type: "ERROR"; payload: Error }
  
  function authReducer(state: AuthState, action: AuthAction): AuthState {
    switch (action.type) {
      case "INIT":
        return { ...state, isLoading: true, error: null }
      case "SET_USER":
        return {
          ...state,
          user: action.payload.user,
          token: action.payload.token,
          isLoading: false,
          isInitialized: true,
          error: null,
        }
      case "CLEAR_USER":
        return {
          ...state,
          user: null,
          token: null,
          isLoading: false,
          isInitialized: true,
          error: null,
        }
      case "ERROR":
        return {
          ...state,
          user: null,
          token: null,
          isLoading: false,
          isInitialized: true,
          error: action.payload,
        }
      default:
        return state
    }
  }
  
  const initialAuthState: AuthState = {
    user: null,
    token: localStorage.getItem("auth_token"),
    isLoading: true,
    isInitialized: false,
    error: null,
  }
  
  const AuthContext = createContext<{
    user: User | null
    token: string | null
    isLoading: boolean
    isInitialized: boolean
    error: Error | null
    login: (token: string) => Promise<boolean>
    logout: () => void
  } | null>(null)
  
  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialAuthState)
  
    // Similar to original useEffect in use-auth.ts
    useEffect(() => {
      let mounted = true
      const loadUser = async () => {
        const token = localStorage.getItem("auth_token")
        if (!token) {
          // No token => just mark as initialized
          dispatch({ type: "ERROR", payload: new Error("No token present") })
          return
        }
        try {
          const user = await api.auth.getProfile()
          if (mounted) {
            dispatch({
              type: "SET_USER",
              payload: { user, token },
            })
          }
        } catch (error) {
          console.error("Auth error:", error)
          localStorage.removeItem("auth_token")
          if (mounted) {
            dispatch({ type: "ERROR", payload: error as Error })
          }
          // Optionally redirect to /login if needed
        }
      }
      loadUser()
      return () => {
        mounted = false
      }
    }, [])
  
    const login = useCallback(async (token: string) => {
      dispatch({ type: "INIT" })
      try {
        localStorage.setItem("auth_token", token)
        const user = await api.auth.getProfile()
        dispatch({ type: "SET_USER", payload: { user, token } })
        return true
      } catch (error) {
        console.error("Login error:", error)
        localStorage.removeItem("auth_token")
        dispatch({ type: "ERROR", payload: error as Error })
        return false
      }
    }, [])
  
    const logout = useCallback(() => {
      localStorage.removeItem("auth_token")
      api.auth.logout() // also sets window.location.href = '/login'
      dispatch({ type: "CLEAR_USER" })
    }, [])
  
    return (
      <AuthContext.Provider
        value={{
          user: state.user,
          token: state.token,
          isLoading: state.isLoading,
          isInitialized: state.isInitialized,
          error: state.error,
          login,
          logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }
  
  export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx)
      throw new Error("useAuth must be used within an AuthProvider")
    return ctx
  }