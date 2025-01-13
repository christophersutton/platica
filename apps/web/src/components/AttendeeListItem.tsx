import type { User } from '@platica/shared/src/models/user';

// If you want presence data, define an interface or import from the shared websockets.
interface PresenceData {
  status: 'online' | 'offline' | 'in_room';
  lastSeen: number;
  customStatus?: string;
  currentRoomId?: number;
}

interface AttendeeListItemProps {
  user: User;           // from our shared model
  presence?: PresenceData; // optional presence object
}

/**
 * Simple user item in a list, possibly shows presence if provided.
 */
export function AttendeeListItem({ user, presence }: AttendeeListItemProps) {
  return (
    <li>
      <strong>{user.name}</strong>{' '}
      {presence
        ? `(${presence.status})`
        : ''}
    </li>
  );
}