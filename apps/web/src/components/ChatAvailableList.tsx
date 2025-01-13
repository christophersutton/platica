import React from 'react';
import { useSelector } from 'react-redux';
import { useGetInitialPresenceQuery } from '../api';
import { selectAvailableForChat } from '../presenceSlice';
import { ChatListItem } from './ChatListItem';

export function ChatAvailableList() {
  // Kick off presence subscription
  const { isLoading } = useGetInitialPresenceQuery();

  // Grabs the subset of users who are online, door open, not in a hub/room
  const availableUsers = useSelector(selectAvailableForChat);

  if (isLoading) return <div>Loading presence info...</div>;

  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-2">Available for Chat</h3>
      <ul>
        {availableUsers.map(record => (
          <ChatListItem
            key={record.user.id}
            user={record.user}
            presence={record.presence}
          />
        ))}
      </ul>
    </div>
  );
}