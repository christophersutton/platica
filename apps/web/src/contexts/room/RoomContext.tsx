import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { ApiRoom, UiRoom, RoomMemberRole } from '@models/room';

interface RoomState {
  rooms: Record<number, UiRoom>;
  activeRoom: number | null;
  isLoadingRooms: boolean;
  roomsError: Error | null;
  typing: Record<number, {
    userIds: number[];
    lastUpdate: number;
  }>;
  presence: Record<number, {
    participants: number[];
    speaking?: number[];
  }>;
}

type RoomAction =
  | { type: 'SET_ROOMS_LOADING' }
  | { type: 'SET_ROOMS'; payload: UiRoom[] }
  | { type: 'SET_ROOMS_ERROR'; payload: Error }
  | { type: 'SET_ACTIVE_ROOM'; payload: number | null }
  | { type: 'UPDATE_ROOM'; payload: { roomId: number; updates: Partial<UiRoom> } }
  | { type: 'SET_TYPING'; payload: { roomId: number; userIds: number[] } }
  | { type: 'SET_PRESENCE'; payload: { roomId: number; participants: number[]; speaking?: number[] } }
  | { type: 'CLEAR_ROOMS' };

const initialState: RoomState = {
  rooms: {},
  activeRoom: null,
  isLoadingRooms: false,
  roomsError: null,
  typing: {},
  presence: {}
};

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'SET_ROOMS_LOADING':
      return {
        ...state,
        isLoadingRooms: true,
        roomsError: null
      };
    case 'SET_ROOMS':
      return {
        ...state,
        rooms: action.payload.reduce((acc, room) => {
          acc[room.id] = room;
          return acc;
        }, {} as Record<number, UiRoom>),
        isLoadingRooms: false,
        roomsError: null
      };
    case 'SET_ROOMS_ERROR':
      return {
        ...state,
        isLoadingRooms: false,
        roomsError: action.payload
      };
    case 'SET_ACTIVE_ROOM':
      return {
        ...state,
        activeRoom: action.payload
      };
    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: {
          ...state.rooms,
          [action.payload.roomId]: {
            ...state.rooms[action.payload.roomId],
            ...action.payload.updates
          }
        }
      };
    case 'SET_TYPING':
      return {
        ...state,
        typing: {
          ...state.typing,
          [action.payload.roomId]: {
            userIds: action.payload.userIds,
            lastUpdate: Date.now()
          }
        }
      };
    case 'SET_PRESENCE':
      return {
        ...state,
        presence: {
          ...state.presence,
          [action.payload.roomId]: {
            participants: action.payload.participants,
            speaking: action.payload.speaking
          }
        }
      };
    case 'CLEAR_ROOMS':
      return initialState;
    default:
      return state;
  }
}

interface RoomContextValue {
  state: RoomState;
  loadRooms: (workspaceId: number) => Promise<void>;
  setActiveRoom: (roomId: number | null) => void;
  updateRoom: (roomId: number, updates: Partial<UiRoom>) => void;
  setTyping: (roomId: number, userIds: number[]) => void;
  setPresence: (roomId: number, participants: number[], speaking?: number[]) => void;
  clearRooms: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading } = useAuth();
  const [state, dispatch] = useReducer(roomReducer, initialState);

  const loadRooms = useCallback(async (workspaceId: number) => {
    if (!token || isAuthLoading) return;
    dispatch({ type: 'SET_ROOMS_LOADING' });
    try {
      // TODO: Implement room API endpoint
      const rooms = [] as ApiRoom[]; // await api.rooms.list(workspaceId);
      const uiRooms: UiRoom[] = rooms.map(room => ({
        ...room,
        hasUnreadMessages: false,
        memberStatus: null
      }));
      dispatch({ type: 'SET_ROOMS', payload: uiRooms });
    } catch (error) {
      dispatch({ type: 'SET_ROOMS_ERROR', payload: error as Error });
    }
  }, [token, isAuthLoading]);

  const setActiveRoom = useCallback((roomId: number | null) => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomId });
  }, []);

  const updateRoom = useCallback((roomId: number, updates: Partial<UiRoom>) => {
    dispatch({ type: 'UPDATE_ROOM', payload: { roomId, updates } });
  }, []);

  const setTyping = useCallback((roomId: number, userIds: number[]) => {
    dispatch({ type: 'SET_TYPING', payload: { roomId, userIds } });
  }, []);

  const setPresence = useCallback((roomId: number, participants: number[], speaking?: number[]) => {
    dispatch({ type: 'SET_PRESENCE', payload: { roomId, participants, speaking } });
  }, []);

  const clearRooms = useCallback(() => {
    dispatch({ type: 'CLEAR_ROOMS' });
  }, []);

  const value = {
    state,
    loadRooms,
    setActiveRoom,
    updateRoom,
    setTyping,
    setPresence,
    clearRooms
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
} 