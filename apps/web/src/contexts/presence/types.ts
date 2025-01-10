import type { User } from '@models/user'
import type { UserPresenceStatus } from '@platica/shared/src/websockets'

export interface UserPresence {
  status: UserPresenceStatus
  lastSeen: number
  customStatus?: string
  currentRoomId?: number
}

export interface PresenceState {
  // Global presence map
  presenceMap: Record<User['id'], UserPresence>
  // Connection state
  isConnected: boolean
  lastUpdate: number
}

export type PresenceAction =
  | { type: 'SET_USER_STATUS'; payload: { userId: number; status: UserPresenceStatus } }
  | { type: 'SET_USER_ROOM'; payload: { userId: number; roomId?: number } }
  | { type: 'SET_CUSTOM_STATUS'; payload: { userId: number; status?: string } }
  | { type: 'SET_LAST_SEEN'; payload: { userId: number; timestamp: number } }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SYNC_PRESENCE'; payload: { userId: number; presence: UserPresence } }
  | { type: 'BULK_SYNC_PRESENCE'; payload: Record<number, UserPresence> } 