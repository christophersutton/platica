import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { api } from "@/lib/api";
import { useAuth } from "../AuthContext";
import { useWebSocket } from "../websocket/WebSocketContext";
import { useWorkspace } from "../workspace/WorkspaceContext";

import { messageReducer, createInitialState } from "./messageReducer";
import {
  WSEventType,
  type OutgoingChatEvent,
  isChatEvent,
} from "@platica/shared/src/websockets";
import type { UiMessage } from "@models/message";

interface MessageContextValue {
  // State
  messages: UiMessage[];
  messagesById: Record<number, UiMessage>;
  activeChannelId: number | null;
  isLoadingMessages: (channelId: number) => boolean;
  isSendingMessage: boolean;
  messageError: (channelId: number) => Error | null;
  sendingError: Error | null;
  hasMoreMessages: (channelId: number) => boolean;

  // Actions
  loadMessages: (
    channelId: number,
    options?: { before?: number }
  ) => Promise<void>;
  sendMessage: (channelId: number, content: string) => void;
  setActiveChannel: (channelId: number | null) => void;
  getChannelMessages: (channelId: number) => UiMessage[];
  getMessageById: (messageId: number) => UiMessage | undefined;
}

const MessageContext = createContext<MessageContextValue | null>(null);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading, user } = useAuth();
  const {
    state: { workspace },
  } = useWorkspace();
  const { subscribe, send } = useWebSocket();
  const [state, dispatch] = useReducer(messageReducer, createInitialState());

  // Subscribe to WebSocket events for chat
  useEffect(() => {
    const unsubscribe = subscribe(WSEventType.CHAT, (event) => {
      if (isChatEvent(event)) {
        const { message } = event.payload;
        dispatch({
          type: "ADD_MESSAGE",
          payload: message,
        });
      }
    });

    return () => unsubscribe();
  }, [subscribe]);

  const loadMessages = useCallback(
    async (channelId: number, options?: { before?: number }) => {
      if (!token || isAuthLoading) {
        return;
      }

      // Check if we're already loading messages
      if (state.loading.channels[channelId]) {
        return;
      }

      // If we already have messages and no pagination param, skip
      const existingMessages = state.channelMessages[channelId] || [];
      if (existingMessages.length > 0 && !options?.before) {
        return;
      }

      dispatch({ type: "SET_CHANNEL_LOADING", payload: { channelId } });

      try {
        const response = await api.channels.getMessages(channelId);
        if (response.messages && response.messages.length > 0) {
          dispatch({
            type: "SET_CHANNEL_MESSAGES",
            payload: {
              channelId,
              messages: response.messages,
            },
          });

          // If the backend pages in blocks of 50 messages, for example:
          dispatch({
            type: "SET_PAGINATION",
            payload: {
              channelId,
              hasMore: response.messages.length === 50,
              lastMessageId:
                response.messages[response.messages.length - 1]?.id || null,
            },
          });
        } else {
          // Even with no messages, mark loading as complete
          dispatch({
            type: "SET_CHANNEL_MESSAGES",
            payload: {
              channelId,
              messages: [],
            },
          });
        }
      } catch (error) {
        dispatch({
          type: "SET_CHANNEL_ERROR",
          payload: {
            channelId,
            error: error as Error,
          },
        });
      }
    },
    [token, isAuthLoading, state.loading.channels, state.channelMessages]
  );

  const sendMessage = useCallback(
    (channelId: number, content: string) => {
      if (!token || isAuthLoading || !content.trim() || !user || !workspace)
        return;

      dispatch({ type: "SET_SENDING_MESSAGE" });

      try {
        const outgoingEvent: OutgoingChatEvent = {
          type: WSEventType.CHAT,
          payload: {
            workspaceId: workspace.id,
            channelId,
            content: content.trim(),
            senderId: user.id,
          },
        };

        const success = send(outgoingEvent);
        if (!success) {
          dispatch({
            type: "SET_SENDING_ERROR",
            payload: new Error(
              "Failed to send message - WebSocket not connected"
            ),
          });
        }
      } catch (error) {
        dispatch({
          type: "SET_SENDING_ERROR",
          payload: error as Error,
        });
      }
    },
    [token, isAuthLoading, user, workspace, send]
  );

  const setActiveChannel = useCallback((channelId: number | null) => {
    dispatch({ type: "SET_ACTIVE_CHANNEL", payload: channelId });
  }, []);

  const getChannelMessages = useCallback(
    (channelId: number): UiMessage[] => {
      const messageIds = state.channelMessages[channelId] || [];
      return messageIds
        .map((id) => state.byId[id])
        .filter((msg): msg is UiMessage => msg !== undefined);
    },
    [state.channelMessages, state.byId]
  );

  const getMessageById = useCallback(
    (messageId: number): UiMessage | undefined => {
      return state.byId[messageId];
    },
    [state.byId]
  );

  const isLoadingMessages = useCallback(
    (channelId: number): boolean => {
      return !!state.loading.channels[channelId];
    },
    [state.loading.channels]
  );

  const messageError = useCallback(
    (channelId: number): Error | null => {
      return state.errors.channels[channelId] || null;
    },
    [state.errors.channels]
  );

  const hasMoreMessages = useCallback(
    (channelId: number): boolean => {
      return !!state.pagination.hasMore[channelId];
    },
    [state.pagination.hasMore]
  );

  const value: MessageContextValue = {
    messages: Object.values(state.byId),
    messagesById: state.byId,
    activeChannelId: state.activeChannelId,
    isLoadingMessages,
    isSendingMessage: state.loading.sending,
    messageError,
    sendingError: state.errors.sending,
    hasMoreMessages,
    loadMessages,
    sendMessage,
    setActiveChannel,
    getChannelMessages,
    getMessageById,
  };

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessageContext);
  if (!ctx) {
    throw new Error("useMessages must be used within MessageProvider");
  }
  return ctx;
}