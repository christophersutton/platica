import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useReducer,
} from "react";
import { api } from "@/lib/api";
import type { AuthState, AuthAction } from "@models/auth";

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "INIT":
      return { ...state, isLoading: true, error: null };
    case "SET_USER":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isInitialized: true,
        error: null,
      };
    case "CLEAR_USER":
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
        error: null,
      };
    case "ERROR":
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
        error: action.payload,
      };
    default:
      return state;
  }
}

const initialAuthState: AuthState = {
  user: null,
  token: localStorage.getItem("auth_token"),
  isLoading: true,
  isInitialized: false,
  error: null,
};

const AuthContext = createContext<
  AuthState & {
    login: (token: string) => Promise<boolean>;
    logout: () => void;
  }
>(null as never);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Load user profile on mount or if there's a stored token
  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        dispatch({ type: "ERROR", payload: new Error("No token present") });
        return;
      }
      try {
        const user = await api.auth.getProfile();
        if (mounted) {
          dispatch({ type: "SET_USER", payload: { user, token } });
        }
      } catch (error) {
        localStorage.removeItem("auth_token");
        if (mounted) {
          dispatch({ type: "ERROR", payload: error as Error });
        }
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (token: string) => {
    dispatch({ type: "INIT" });
    try {
      localStorage.setItem("auth_token", token);
      const user = await api.auth.getProfile();
      dispatch({ type: "SET_USER", payload: { user, token } });
      return true;
    } catch (error) {
      localStorage.removeItem("auth_token");
      dispatch({ type: "ERROR", payload: error as Error });
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    api.auth.logout();
    dispatch({ type: "CLEAR_USER" });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
