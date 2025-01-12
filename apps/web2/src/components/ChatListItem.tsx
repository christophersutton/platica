import React from 'react';
import { PublicUserResponse } from '../../../shared/types/user';

interface ChatListItemProps {
  user: PublicUserResponse;
  presence: {
    isOnline: boolean;
    doorStatus: 'open' | 'closed';
    currentLocation: { type: 'none' | 'hub' | 'room'; id: string | null };
    lastActive: Date;
  };
}

export function ChatListItem({ user, presence }: ChatListItemProps) {
  return (
    <li className="border-b py-2">
      <span className="font-semibold">{user.name}</span> &mdash;{' '}
      {presence.isOnline ? 'Online' : 'Offline'} / Door: {presence.doorStatus}
    </li>
  );
}