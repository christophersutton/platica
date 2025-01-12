import React, { createContext, useContext, useReducer, useCallback, useEffect } from "react";
import { useWebSocket } from "../websocket/WebSocketContext";
import { useAuth } from "../AuthContext";
import { presenceReducer, createInitialState } from "./presenceReducer";
import type { UserPresence } from "./types";
import { WSEventType } from "@platica/shared/src/websockets";
import type {
  PresenceEvent,
  PresenceSyncEvent,
  UserPresenceStatus,
} from "@platica/shared/src/websockets";

interface PresenceContextValue {
  // State
  presenceMap: Record<number, UserPresence>;
  isConnected: boolean;
  lastUpdate: number;

  // Actions
  setUserStatus: (userId: number, status: UserPresenceStatus) => void;
  setUserRoom: (userId: number, roomId?: number) => void;
  setCustomStatus: (userId: number, status?: string) => void;
  getUserPresence: (userId: number) => UserPresence | undefined;
  isUserAvailableForChat: (userId: number) => boolean;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { subscribe, send } = useWebSocket();
  const [state, dispatch] = useReducer(presenceReducer, createInitialState());

  // Subscribe to presence events
  useEffect(() => {
    if (!user) return;

    // Handle individual presence updates
    const unsubPresence = subscribe(WSEventType.PRESENCE, (event: PresenceEvent) => {
      const { userId, status, customStatus } = event.payload;
      dispatch({
        type: "SYNC_PRESENCE",
        payload: {
          userId,
          presence: {
            status,
            lastSeen: Date.now(),
            customStatus,
          },
        },
      });
    });

    // Handle bulk presence sync
    const unsubSync = subscribe(WSEventType.PRESENCE_SYNC, (event: PresenceSyncEvent) => {
      const presenceMap: Record<number, UserPresence> = {};
      const now = Date.now();

      event.payload.onlineUsers.forEach((onlineUserId) => {
        presenceMap[onlineUserId] = {
          status: "online",
          lastSeen: now,
        };
      });

      dispatch({ type: "BULK_SYNC_PRESENCE", payload: presenceMap });
    });

    // Broadcast initial presence
    send({
      type: WSEventType.PRESENCE,
      payload: {
        userId: user.id,
        status: "online",
      },
    });

    return () => {
      unsubPresence();
      unsubSync();
    };
  }, [user, subscribe, send]);

  // Actions
  const setUserStatus = useCallback(
    (userId: number, status: UserPresenceStatus) => {
      dispatch({ type: "SET_USER_STATUS", payload: { userId, status } });
      if (user?.id === userId) {
        send({
          type: WSEventType.PRESENCE,
          payload: {
            userId,
            status,
            customStatus: state.presenceMap[userId]?.customStatus,
          },
        });
      }
    },
    [user, send, state.presenceMap]
  );

  const setUserRoom = useCallback(
    (userId: number, roomId?: number) => {
      dispatch({ type: "SET_USER_ROOM", payload: { userId, roomId } });
      if (user?.id === userId) {
        send({
          type: WSEventType.PRESENCE,
          payload: {
            userId,
            status: roomId ? "in_room" : "online",
            customStatus: state.presenceMap[userId]?.customStatus,
          },
        });
      }
    },
    [user, send, state.presenceMap]
  );

  const setCustomStatus = useCallback(
    (userId: number, status?: string) => {
      dispatch({ type: "SET_CUSTOM_STATUS", payload: { userId, status } });
      if (user?.id === userId) {
        send({
          type: WSEventType.PRESENCE,
          payload: {
            userId,
            status: state.presenceMap[userId]?.status || "online",
            customStatus: status,
          },
        });
      }
    },
    [user, send, state.presenceMap]
  );

  const getUserPresence = useCallback(
    (userId: number) => {
      return state.presenceMap[userId];
    },
    [state.presenceMap]
  );

  const isUserAvailableForChat = useCallback(
    (userId: number) => {
      const presence = state.presenceMap[userId];
      if (!presence) return false;
      // If you only consider "online" as available, adjust logic here:
      return presence.status === "online";
    },
    [state.presenceMap]
  );

  const value: PresenceContextValue = {
    presenceMap: state.presenceMap,
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    setUserStatus,
    setUserRoom,
    setCustomStatus,
    getUserPresence,
    isUserAvailableForChat,
  };

  return (
    <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
}

// Convenience hooks
export function useUserPresence(userId: number) {
  const { getUserPresence } = usePresence();
  return getUserPresence(userId);
}

export function useIsUserAvailableForChat(userId: number) {
  const { isUserAvailableForChat } = usePresence();
  return isUserAvailableForChat(userId);
}