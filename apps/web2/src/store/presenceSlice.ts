import { createSlice, createSelector, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { User } from '@models/user';
import type { Presence } from '@models/schemas';

interface ExtendedPresenceState {
  byId: Record<number, {
    user: Pick<User, 'id' | 'name' | 'email'>;
    presence: Presence;
  }>;
  hubMembers: Record<string, number[]>;
  roomAttendees: Record<string, number[]>;
}

const initialPresence: Presence = {
  isOnline: false,
  doorStatus: 'closed',
  currentLocation: {
    type: 'none',
    id: null
  },
  lastActive: new Date().toISOString()
};

const initialState: ExtendedPresenceState = {
  byId: {},
  hubMembers: {},
  roomAttendees: {}
};

export const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    presenceUpdated(state, action: PayloadAction<{
      userId: number;
      type: 'connect' | 'disconnect' | 'enter_hub' | 'exit_hub' | 'enter_room' | 'exit_room';
      payload: Partial<Presence>;
      timestamp?: string;
    }>) {
      const { userId, type, payload, timestamp } = action.payload;

      if (!state.byId[userId]) {
        state.byId[userId] = {
          user: { id: userId, name: 'Unknown', email: '' },
          presence: { ...initialPresence }
        };
      }
      const record = state.byId[userId];
      record.presence = {
        ...record.presence,
        ...payload,
        lastActive: timestamp || new Date().toISOString()
      };

      if (type === 'connect') {
        record.presence.isOnline = true;
      } else if (type === 'disconnect') {
        record.presence.isOnline = false;
      }

      if (type === 'enter_hub') {
        const hubId = payload.currentLocation?.id;
        if (hubId) {
          state.hubMembers[hubId] = state.hubMembers[hubId] || [];
          if (!state.hubMembers[hubId].includes(userId)) {
            state.hubMembers[hubId].push(userId);
          }
        }
      } else if (type === 'exit_hub') {
        const oldHubId = record.presence.currentLocation.id;
        if (oldHubId && state.hubMembers[oldHubId]) {
          state.hubMembers[oldHubId] =
            state.hubMembers[oldHubId].filter((id) => id !== userId);
        }
      }

      if (type === 'enter_room') {
        const roomId = payload.currentLocation?.id;
        if (roomId) {
          state.roomAttendees[roomId] = state.roomAttendees[roomId] || [];
          if (!state.roomAttendees[roomId].includes(userId)) {
            state.roomAttendees[roomId].push(userId);
          }
        }
      } else if (type === 'exit_room') {
        const oldRoomId = record.presence.currentLocation.id;
        if (oldRoomId && state.roomAttendees[oldRoomId]) {
          state.roomAttendees[oldRoomId] =
            state.roomAttendees[oldRoomId].filter((id) => id !== userId);
        }
      }
    },
  },
});

export const { presenceUpdated } = presenceSlice.actions;

export default presenceSlice.reducer;

// Selectors
export const selectPresenceById = (state: RootState) => state.presence.byId;
export const selectPresenceRecord =
  (userId: number) => (state: RootState) => state.presence.byId[userId] || null;

// Example: get the list of presence records for a specific hub
export const selectHubMembers = (hubId: string) =>
  createSelector(
    (state: RootState) => state.presence.hubMembers[hubId] || [],
    (state: RootState) => state.presence.byId,
    (memberIds, byId) => memberIds.map((uid) => byId[uid]).filter(Boolean)
  );

// Example: who is currently available for chat
export const selectAvailableForChat = createSelector(
  selectPresenceById,
  (presenceById) =>
    Object.values(presenceById).filter((record) =>
      record.presence.isOnline &&
      record.presence.doorStatus === 'open' &&
      record.presence.currentLocation.type === 'none'
    )
);