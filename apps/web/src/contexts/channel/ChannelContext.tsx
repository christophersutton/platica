import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { api } from "@/lib/api";
import { type UiHub } from "@models/hub
";
import { useAuth } from "../AuthContext";
import { useWebSocket } from "../websocket/WebSocketContext";
import {
  hubReducer,
  createInitialState,
} from "./hubReducer";
import { WSEventType } from "@platica/shared/src/websockets";
import type {
  HubCreatedEvent,
  TypingEvent,
} from "@platica/shared/src/websockets";

interface HubContextValue {
  // State
  hubs: UiHub[];
  hubsById: Record<number, UiHub>;
  activeHubId: number | null;
  isLoadingHubs: boolean;
  isCreatingHub: boolean;
  hubsError: Error | null;
  creatingError: Error | null;

  // Typing state
  typingUsers: (hubId: number) => number[];
  isUserTyping: (hubId: number, userId: number) => boolean;
  setTyping: (hubId: number, isTyping: boolean) => void;

  // Actions
  loadHubs: (workspaceId: number) => Promise<void>;
  createHub: (
    workspaceId: number,
    data: {
      name: string;
      description?: string;
      is_private?: boolean;
    }
  ) => Promise<void>;
  markHubAsRead: (hubId: number) => Promise<void>;
  setActiveHub: (hubId: number | null) => void;
  getHubById: (hubId: number) => UiHub | undefined;
  getWorkspaceHubs: (workspaceId: number) => UiHub[];
}

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading, user } = useAuth();
  const { subscribe, send } = useWebSocket();
  const [state, dispatch] = useReducer(hubReducer, createInitialState());

  // Subscribe to relevant WebSocket events
  useEffect(() => {
    const unsubscribeHub = subscribe(
      WSEventType.CHANNEL_CREATED,
      (message: HubCreatedEvent) => {
        dispatch({ type: "ADD_CHANNEL", payload: message.payload.hub
 });
      }
    );

    const unsubscribeTyping = subscribe(
      WSEventType.TYPING,
      (message: TypingEvent) => {
        dispatch({
          type: "SET_USER_TYPING",
          payload: {
            hubId: message.payload.hubId,
            userId: message.payload.userId,
            isTyping: message.payload.isTyping,
          },
        });
      }
    );

    return () => {
      unsubscribeHub();
      unsubscribeTyping();
    };
  }, [subscribe]);

  // Clean up stale typing indicators every 3s
  useEffect(() => {
    const TYPING_TIMEOUT = 3000; // 3 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      Object.entries(state.typing.byHub).forEach(
        ([hubId, hubTyping]) => {
          const staleUsers = hubTyping.userIds.filter((userId) => {
            const lastUpdate = hubTyping.lastUpdated[userId];
            return now - lastUpdate > TYPING_TIMEOUT;
          });

          staleUsers.forEach((userId) => {
            dispatch({
              type: "SET_USER_TYPING",
              payload: {
                hubId: Number(hubId),
                userId,
                isTyping: false,
              },
            });
          });
        }
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [state.typing.byHub]);

  const loadHubs = useCallback(
    async (workspaceId: number) => {
      if (!token || isAuthLoading) return;
      dispatch({ type: "SET_CHANNELS_LOADING" });
      try {
        const res = await api.hubs.list(workspaceId);
        dispatch({
          type: "SET_CHANNELS",
          payload: {
            hubs: res.hubs,
            workspaceId,
          },
        });
      } catch (error) {
        dispatch({ type: "SET_CHANNELS_ERROR", payload: error as Error });
      }
    },
    [token, isAuthLoading]
  );

  const createHub = useCallback(
    async (
      workspaceId: number,
      data: { name: string; description?: string; is_private?: boolean }
    ) => {
      if (!token || isAuthLoading) return;
      dispatch({ type: "SET_CREATING_CHANNEL" });
      try {
        const response = await api.hubs.create(workspaceId, data);
        dispatch({ type: "ADD_CHANNEL", payload: response.hub
 });
      } catch (error) {
        dispatch({ type: "SET_CREATING_CHANNEL_ERROR", payload: error as Error });
      }
    },
    [token, isAuthLoading]
  );

  const markHubAsRead = useCallback(
    async (hubId: number) => {
      if (!token || isAuthLoading) return;
      try {
        await api.hubs.markAsRead(hubId);
        dispatch({ type: "MARK_CHANNEL_READ", payload: hubId });
      } catch (error) {
        console.error("Failed to mark hub
 as read:", error);
      }
    },
    [token, isAuthLoading]
  );

  const setActiveHub = useCallback((hubId: number | null) => {
    dispatch({ type: "SET_ACTIVE_CHANNEL", payload: hubId });
  }, []);

  const getHubById = useCallback(
    (hubId: number) => state.byId[hubId],
    [state.byId]
  );

  const getWorkspaceHubs = useCallback(
    (workspaceId: number): UiHub[] => {
      const hubIds = state.workspaceHubs[workspaceId] || [];
      return hubIds
        .map((id) => state.byId[id])
        .filter((ch): ch is UiHub => ch !== undefined);
    },
    [state.workspaceHubs, state.byId]
  );

  const typingUsers = useCallback(
    (hubId: number) => state.typing.byHub[hubId]?.userIds || [],
    [state.typing.byHub]
  );

  const isUserTyping = useCallback(
    (hubId: number, userId: number) =>
      state.typing.byHub[hubId]?.userIds.includes(userId) || false,
    [state.typing.byHub]
  );

  // Actually update typing status & send to WS
  const setTyping = useCallback(
    (hubId: number, isTyping: boolean) => {
      if (!user) return;

      dispatch({
        type: "SET_USER_TYPING",
        payload: {
          hubId,
          userId: user.id,
          isTyping,
        },
      });

      send({
        type: WSEventType.TYPING,
        payload: {
          hubId,
          userId: user.id,
          isTyping,
        },
      });
    },
    [user, send]
  );

  const value: HubContextValue = {
    hubs: state.allIds.map((id) => state.byId[id]),
    hubsById: state.byId,
    activeHubId: state.activeHubId,
    isLoadingHubs: state.loading.hubs,
    isCreatingHub: state.loading.creating,
    hubsError: state.errors.hubs,
    creatingError: state.errors.creating,
    typingUsers,
    isUserTyping,
    setTyping,
    loadHubs,
    createHub,
    markHubAsRead,
    setActiveHub,
    getHubById,
    getWorkspaceHubs,
  };

  return (
    <HubContext.Provider value={value}>{children}</HubContext.Provider>
  );
}

export function useHubs() {
  const ctx = useContext(HubContext);
  if (!ctx) {
    throw new Error("useHubs must be used within HubProvider");
  }
  return ctx;
}