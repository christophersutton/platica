import React from 'react';
import { PublicUserResponse } from '../../../shared/types';

interface AttendeeListItemProps {
  user: PublicUserResponse;
  presence: {
    isOnline: boolean;
    doorStatus: 'open' | 'closed';
    currentLocation: { type: 'none' | 'hub' | 'room'; id: string | null };
    lastActive: Date;
  };
}

export function AttendeeListItem({ user, presence }: AttendeeListItemProps) {
  return (
    <li>
      <strong>{user.name}</strong> {presence.isOnline ? '(Online)' : '(Offline)'}
    </li>
  );
}