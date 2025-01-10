import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { api } from "@/lib/api";
import { type UiChannel } from "@models/channel";
import { useAuth } from "../AuthContext";
import { useWebSocket } from "../websocket/WebSocketContext";
import {
  channelReducer,
  createInitialState,
} from "./channelReducer";
import { WSEventType } from "@platica/shared/src/websockets";
import type {
  ChannelCreatedEvent,
  TypingEvent,
} from "@platica/shared/src/websockets";

interface ChannelContextValue {
  // State
  channels: UiChannel[];
  channelsById: Record<number, UiChannel>;
  activeChannelId: number | null;
  isLoadingChannels: boolean;
  isCreatingChannel: boolean;
  channelsError: Error | null;
  creatingError: Error | null;

  // Typing state
  typingUsers: (channelId: number) => number[];
  isUserTyping: (channelId: number, userId: number) => boolean;
  setTyping: (channelId: number, isTyping: boolean) => void;

  // Actions
  loadChannels: (workspaceId: number) => Promise<void>;
  createChannel: (
    workspaceId: number,
    data: {
      name: string;
      description?: string;
      is_private?: boolean;
    }
  ) => Promise<void>;
  markChannelAsRead: (channelId: number) => Promise<void>;
  setActiveChannel: (channelId: number | null) => void;
  getChannelById: (channelId: number) => UiChannel | undefined;
  getWorkspaceChannels: (workspaceId: number) => UiChannel[];
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading, user } = useAuth();
  const { subscribe, send } = useWebSocket();
  const [state, dispatch] = useReducer(channelReducer, createInitialState());

  // Subscribe to relevant WebSocket events
  useEffect(() => {
    const unsubscribeChannel = subscribe(
      WSEventType.CHANNEL_CREATED,
      (message: ChannelCreatedEvent) => {
        dispatch({ type: "ADD_CHANNEL", payload: message.payload.channel });
      }
    );

    const unsubscribeTyping = subscribe(
      WSEventType.TYPING,
      (message: TypingEvent) => {
        dispatch({
          type: "SET_USER_TYPING",
          payload: {
            channelId: message.payload.channelId,
            userId: message.payload.userId,
            isTyping: message.payload.isTyping,
          },
        });
      }
    );

    return () => {
      unsubscribeChannel();
      unsubscribeTyping();
    };
  }, [subscribe]);

  // Clean up stale typing indicators every 3s
  useEffect(() => {
    const TYPING_TIMEOUT = 3000; // 3 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      Object.entries(state.typing.byChannel).forEach(
        ([channelId, channelTyping]) => {
          const staleUsers = channelTyping.userIds.filter((userId) => {
            const lastUpdate = channelTyping.lastUpdated[userId];
            return now - lastUpdate > TYPING_TIMEOUT;
          });

          staleUsers.forEach((userId) => {
            dispatch({
              type: "SET_USER_TYPING",
              payload: {
                channelId: Number(channelId),
                userId,
                isTyping: false,
              },
            });
          });
        }
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [state.typing.byChannel]);

  const loadChannels = useCallback(
    async (workspaceId: number) => {
      if (!token || isAuthLoading) return;
      dispatch({ type: "SET_CHANNELS_LOADING" });
      try {
        const res = await api.channels.list(workspaceId);
        dispatch({
          type: "SET_CHANNELS",
          payload: {
            channels: res.channels,
            workspaceId,
          },
        });
      } catch (error) {
        dispatch({ type: "SET_CHANNELS_ERROR", payload: error as Error });
      }
    },
    [token, isAuthLoading]
  );

  const createChannel = useCallback(
    async (
      workspaceId: number,
      data: { name: string; description?: string; is_private?: boolean }
    ) => {
      if (!token || isAuthLoading) return;
      dispatch({ type: "SET_CREATING_CHANNEL" });
      try {
        const response = await api.channels.create(workspaceId, data);
        dispatch({ type: "ADD_CHANNEL", payload: response.channel });
      } catch (error) {
        dispatch({ type: "SET_CREATING_CHANNEL_ERROR", payload: error as Error });
      }
    },
    [token, isAuthLoading]
  );

  const markChannelAsRead = useCallback(
    async (channelId: number) => {
      if (!token || isAuthLoading) return;
      try {
        await api.channels.markAsRead(channelId);
        dispatch({ type: "MARK_CHANNEL_READ", payload: channelId });
      } catch (error) {
        console.error("Failed to mark channel as read:", error);
      }
    },
    [token, isAuthLoading]
  );

  const setActiveChannel = useCallback((channelId: number | null) => {
    dispatch({ type: "SET_ACTIVE_CHANNEL", payload: channelId });
  }, []);

  const getChannelById = useCallback(
    (channelId: number) => state.byId[channelId],
    [state.byId]
  );

  const getWorkspaceChannels = useCallback(
    (workspaceId: number): UiChannel[] => {
      const channelIds = state.workspaceChannels[workspaceId] || [];
      return channelIds
        .map((id) => state.byId[id])
        .filter((ch): ch is UiChannel => ch !== undefined);
    },
    [state.workspaceChannels, state.byId]
  );

  const typingUsers = useCallback(
    (channelId: number) => state.typing.byChannel[channelId]?.userIds || [],
    [state.typing.byChannel]
  );

  const isUserTyping = useCallback(
    (channelId: number, userId: number) =>
      state.typing.byChannel[channelId]?.userIds.includes(userId) || false,
    [state.typing.byChannel]
  );

  // Actually update typing status & send to WS
  const setTyping = useCallback(
    (channelId: number, isTyping: boolean) => {
      if (!user) return;

      dispatch({
        type: "SET_USER_TYPING",
        payload: {
          channelId,
          userId: user.id,
          isTyping,
        },
      });

      send({
        type: WSEventType.TYPING,
        payload: {
          channelId,
          userId: user.id,
          isTyping,
        },
      });
    },
    [user, send]
  );

  const value: ChannelContextValue = {
    channels: state.allIds.map((id) => state.byId[id]),
    channelsById: state.byId,
    activeChannelId: state.activeChannelId,
    isLoadingChannels: state.loading.channels,
    isCreatingChannel: state.loading.creating,
    channelsError: state.errors.channels,
    creatingError: state.errors.creating,
    typingUsers,
    isUserTyping,
    setTyping,
    loadChannels,
    createChannel,
    markChannelAsRead,
    setActiveChannel,
    getChannelById,
    getWorkspaceChannels,
  };

  return (
    <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>
  );
}

export function useChannels() {
  const ctx = useContext(ChannelContext);
  if (!ctx) {
    throw new Error("useChannels must be used within ChannelProvider");
  }
  return ctx;
}