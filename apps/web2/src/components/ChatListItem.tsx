import type { User } from '@platica/shared/src/models/user';

interface PresenceData {
  status: 'online' | 'offline' | 'in_room';
  lastSeen: number;
  customStatus?: string;
  currentRoomId?: number;
}

interface ChatListItemProps {
  user: User;
  presence?: PresenceData;
}

export function ChatListItem({ user, presence }: ChatListItemProps) {
  const isOnline = presence?.status === 'online' || presence?.status === 'in_room';
  

  return (
    <li className="border-b py-2">
      <span className="font-semibold">{user.name}</span> &mdash;{' '}
      {isOnline ? 'Online' : 'Offline'}
      {presence?.status === 'in_room' && ` / Currently in a Room`}
      {presence?.customStatus ? ` / ${presence.customStatus}` : ''}
      <br />
      <small>Last seen: {presence?.lastSeen ? new Date(presence.lastSeen * 1000).toLocaleString() : 'N/A'}</small>
    </li>
  );
}