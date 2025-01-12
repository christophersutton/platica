import { createSlice, createSelector, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { UserPresence, PresenceEvent } from '@platica/shared/src/websockets';

// Extended presence record that includes user info
interface ExtendedUserPresence extends UserPresence {
  user: {
    id: number;
    name: string;
    role: string;
  };
}

interface ExtendedPresenceState {
  byId: Record<string, ExtendedUserPresence>;
  hubMembers: Record<string, string[]>;
  roomAttendees: Record<string, string[]>;
}

const initialState: ExtendedPresenceState = {
  byId: {},
  hubMembers: {},
  roomAttendees: {}
};

export const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    presenceUpdated(state, action: PayloadAction<PresenceEvent>) {
      const { payload } = action.payload;
      const { userId, status, customStatus } = payload;

      if (!state.byId[userId]) {
        state.byId[userId] = {
          user: { id: userId, name: 'Unknown', role: 'member' },
          status: 'offline',
          lastSeen: new Date().getTime(),
          customStatus: undefined,
          currentRoomId: undefined
        };
      }

      const record = state.byId[userId];
      record.status = status;
      record.lastSeen = new Date().getTime();
      if (customStatus !== undefined) {
        record.customStatus = customStatus;
      }

      // Handle room presence - we'll need a separate action for this
      if (status === 'in_room') {
        // Room handling will be done by a separate action
        record.status = 'in_room';
      } else if (record.currentRoomId !== undefined) {
        // Clear room if user is no longer in room status
        const oldRoomId = record.currentRoomId.toString();
        record.currentRoomId = undefined;
        if (state.roomAttendees[oldRoomId]) {
          state.roomAttendees[oldRoomId] = 
            state.roomAttendees[oldRoomId].filter(id => id !== userId.toString());
        }
      }
    },
    // Add a separate action for room updates
    roomPresenceUpdated(state, action: PayloadAction<{ userId: number; roomId: number | null }>) {
      const { userId, roomId } = action.payload;
      const record = state.byId[userId];
      
      if (!record) return;

      // Clear old room if exists
      if (record.currentRoomId !== undefined) {
        const oldRoomId = record.currentRoomId.toString();
        if (state.roomAttendees[oldRoomId]) {
          state.roomAttendees[oldRoomId] = 
            state.roomAttendees[oldRoomId].filter(id => id !== userId.toString());
        }
      }

      // Set new room if provided
      if (roomId) {
        record.currentRoomId = roomId;
        record.status = 'in_room';
        const roomIdStr = roomId.toString();
        state.roomAttendees[roomIdStr] = state.roomAttendees[roomIdStr] || [];
        if (!state.roomAttendees[roomIdStr].includes(userId.toString())) {
          state.roomAttendees[roomIdStr].push(userId.toString());
        }
      } else {
        record.currentRoomId = undefined;
        record.status = 'online';
      }
    }
  },
});

export const { presenceUpdated, roomPresenceUpdated } = presenceSlice.actions;

export default presenceSlice.reducer;

// Selectors
export const selectPresenceById = (state: RootState) => state.presence.byId;
export const selectPresenceRecord = 
  (userId: string) => (state: RootState) => state.presence.byId[userId] || null;

// Get the list of presence records for a specific hub
export const selectHubMembers = (hubId: string) =>
  createSelector(
    (state: RootState) => state.presence.hubMembers[hubId] || [],
    (state: RootState) => state.presence.byId,
    (memberIds, byId) => memberIds.map(uid => byId[uid]).filter(Boolean)
  );

// Who is currently available for chat
export const selectAvailableForChat = createSelector(
  selectPresenceById,
  (presenceById) =>
    Object.values(presenceById).filter((record) =>
      record.status === 'online' &&
      !record.currentRoomId
    )
);