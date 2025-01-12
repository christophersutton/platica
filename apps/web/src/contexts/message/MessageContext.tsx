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
  activeHubId: number | null;
  isLoadingMessages: (hubId: number) => boolean;
  isSendingMessage: boolean;
  messageError: (hubId: number) => Error | null;
  sendingError: Error | null;
  hasMoreMessages: (hubId: number) => boolean;

  // Actions
  loadMessages: (
    hubId: number,
    options?: { before?: number }
  ) => Promise<void>;
  sendMessage: (hubId: number, content: string) => void;
  setActiveHub: (hubId: number | null) => void;
  getHubMessages: (hubId: number) => UiMessage[];
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
    async (hubId: number, options?: { before?: number }) => {
      if (!token || isAuthLoading) {
        return;
      }

      // Check if we're already loading messages
      if (state.loading.hubs[hubId]) {
        return;
      }

      // If we already have messages and no pagination param, skip
      const existingMessages = state.hubMessages[hubId] || [];
      if (existingMessages.length > 0 && !options?.before) {
        return;
      }

      dispatch({ type: "SET_HUB_LOADING", payload: { hubId } });

      try {
        const response = await api.hubs.getMessages(hubId);
        if (response.messages && response.messages.length > 0) {
          dispatch({
            type: "SET_HUB_MESSAGES",
            payload: {
              hubId,
              messages: response.messages
            }
          });
        } else {
          // Even with no messages, mark loading as complete
          dispatch({
            type: "SET_HUB_MESSAGES",
            payload: {
              hubId,
              messages: []
            }
          });
        }
      } catch (error) {
        dispatch({
          type: "SET_HUB_ERROR",
          payload: {
            hubId,
            error: error as Error
          }
        });
      }
    },
    [token, isAuthLoading, state.loading.hubs, state.hubMessages]
  );

  const sendMessage = useCallback(
    (hubId: number, content: string) => {
      if (!token || isAuthLoading || !content.trim() || !user || !workspace)
        return;

      dispatch({ type: "SET_SENDING_MESSAGE" });

      try {
        const outgoingEvent: OutgoingChatEvent = {
          type: WSEventType.CHAT,
          payload: {
            workspaceId: workspace.id,
            hubId,
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

  const setActiveHub = useCallback((hubId: number | null) => {
    dispatch({ type: "SET_ACTIVE_HUB", payload: hubId });
  }, []);

  const getHubMessages = useCallback(
    (hubId: number): UiMessage[] => {
      const messageIds = state.hubMessages[hubId] || [];
      return messageIds
        .map((id) => state.byId[id])
        .filter((msg): msg is UiMessage => msg !== undefined);
    },
    [state.hubMessages, state.byId]
  );

  const getMessageById = useCallback(
    (messageId: number): UiMessage | undefined => {
      return state.byId[messageId];
    },
    [state.byId]
  );

  const isLoadingMessages = useCallback(
    (hubId: number): boolean => {
      return !!state.loading.hubs[hubId];
    },
    [state.loading.hubs]
  );

  const messageError = useCallback(
    (hubId: number): Error | null => {
      return state.errors.hubs[hubId] || null;
    },
    [state.errors.hubs]
  );

  const hasMoreMessages = useCallback(
    (hubId: number): boolean => {
      return !!state.pagination.hasMore[hubId];
    },
    [state.pagination.hasMore]
  );

  const value: MessageContextValue = {
    messages: Object.values(state.byId),
    messagesById: state.byId,
    activeHubId: state.activeHubId,
    isLoadingMessages,
    isSendingMessage: state.loading.sending,
    messageError,
    sendingError: state.errors.sending,
    hasMoreMessages,
    loadMessages,
    sendMessage,
    setActiveHub,
    getHubMessages,
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