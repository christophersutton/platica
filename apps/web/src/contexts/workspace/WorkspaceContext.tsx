import React, { createContext, useContext, useReducer, useCallback } from "react";
import { useAuth } from "../AuthContext";
import { api } from "@/lib/api";
import type { ApiWorkspace, UiWorkspace } from "@models/workspace";

interface WorkspaceState {
  workspace: UiWorkspace | null;
  isLoadingWorkspace: boolean;
  workspaceError: Error | null;
}

type WorkspaceAction =
  | { type: "SET_WORKSPACE_LOADING" }
  | { type: "SET_WORKSPACE"; payload: UiWorkspace }
  | { type: "SET_WORKSPACE_ERROR"; payload: Error }
  | { type: "UPDATE_WORKSPACE"; payload: Partial<UiWorkspace> }
  | { type: "CLEAR_WORKSPACE" };

const initialState: WorkspaceState = {
  workspace: null,
  isLoadingWorkspace: false,
  workspaceError: null,
};

function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "SET_WORKSPACE_LOADING":
      return {
        ...state,
        isLoadingWorkspace: true,
        workspaceError: null,
      };
    case "SET_WORKSPACE":
      return {
        ...state,
        workspace: action.payload,
        isLoadingWorkspace: false,
        workspaceError: null,
      };
    case "SET_WORKSPACE_ERROR":
      return {
        ...state,
        isLoadingWorkspace: false,
        workspaceError: action.payload,
      };
    case "UPDATE_WORKSPACE":
      return {
        ...state,
        workspace: state.workspace
          ? { ...state.workspace, ...action.payload }
          : null,
      };
    case "CLEAR_WORKSPACE":
      return initialState;
    default:
      return state;
  }
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  loadWorkspace: (id: number) => Promise<void>;
  updateWorkspace: (updates: Partial<UiWorkspace>) => void;
  clearWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading } = useAuth();
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  const loadWorkspace = useCallback(
    async (workspaceId: number) => {
      if (!token || isAuthLoading) return;
      dispatch({ type: "SET_WORKSPACE_LOADING" });
      try {
        const workspace = (await api.workspaces.get(
          workspaceId
        )) as ApiWorkspace;
        const uiWorkspace: UiWorkspace = {
          ...workspace,
          unreadCount: 0,
          mentionCount: 0,
        };
        dispatch({ type: "SET_WORKSPACE", payload: uiWorkspace });
      } catch (error) {
        dispatch({ type: "SET_WORKSPACE_ERROR", payload: error as Error });
      }
    },
    [token, isAuthLoading]
  );

  const updateWorkspace = useCallback((updates: Partial<UiWorkspace>) => {
    dispatch({ type: "UPDATE_WORKSPACE", payload: updates });
  }, []);

  const clearWorkspace = useCallback(() => {
    dispatch({ type: "CLEAR_WORKSPACE" });
  }, []);

  const value = {
    state,
    loadWorkspace,
    updateWorkspace,
    clearWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}