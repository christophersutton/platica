import type { PresenceState, PresenceAction } from './types'

export function createInitialState(): PresenceState {
  return {
    presenceMap: {},
    isConnected: false,
    lastUpdate: Date.now()
  }
}

export function presenceReducer(state: PresenceState, action: PresenceAction): PresenceState {
  const now = Date.now()

  switch (action.type) {
    case 'SET_USER_STATUS': {
      const { userId, status } = action.payload
      const existing = state.presenceMap[userId] || {
        status: 'offline',
        lastSeen: now
      }
      
      return {
        ...state,
        lastUpdate: now,
        presenceMap: {
          ...state.presenceMap,
          [userId]: {
            ...existing,
            status,
            lastSeen: now
          }
        }
      }
    }

    case 'SET_USER_ROOM': {
      const { userId, roomId } = action.payload
      const existing = state.presenceMap[userId]
      if (!existing) return state

      return {
        ...state,
        lastUpdate: now,
        presenceMap: {
          ...state.presenceMap,
          [userId]: {
            ...existing,
            status: roomId ? 'in_room' : 'online',
            currentRoomId: roomId,
            lastSeen: now
          }
        }
      }
    }

    case 'SET_CUSTOM_STATUS': {
      const { userId, status } = action.payload
      const existing = state.presenceMap[userId]
      if (!existing) return state

      return {
        ...state,
        lastUpdate: now,
        presenceMap: {
          ...state.presenceMap,
          [userId]: {
            ...existing,
            customStatus: status,
            lastSeen: now
          }
        }
      }
    }

    case 'SET_LAST_SEEN': {
      const { userId, timestamp } = action.payload
      const existing = state.presenceMap[userId]
      if (!existing) return state

      return {
        ...state,
        lastUpdate: now,
        presenceMap: {
          ...state.presenceMap,
          [userId]: {
            ...existing,
            lastSeen: timestamp
          }
        }
      }
    }

    case 'SET_CONNECTED': {
      return {
        ...state,
        lastUpdate: now,
        isConnected: action.payload
      }
    }

    case 'SYNC_PRESENCE': {
      const { userId, presence } = action.payload
      return {
        ...state,
        lastUpdate: now,
        presenceMap: {
          ...state.presenceMap,
          [userId]: presence
        }
      }
    }

    case 'BULK_SYNC_PRESENCE': {
      return {
        ...state,
        lastUpdate: now,
        presenceMap: {
          ...state.presenceMap,
          ...action.payload
        }
      }
    }

    default:
      return state
  }
} 