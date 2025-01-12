import React from 'react';
import { useGetRoomMessagesQuery } from '../api';
import { Message } from '../../../shared/types';
import { MessageItem } from './MessageItem';

interface MessagesListProps {
  roomId: string;
}

export function MessagesList({ roomId }: MessagesListProps) {
  const { data: messages, isLoading } = useGetRoomMessagesQuery(roomId);

  if (isLoading) return <div>Loading messages...</div>;
  if (!messages) return <div>No messages found or failed to load.</div>;

  return (
    <div className="flex flex-col space-y-2 p-2 border rounded h-64 overflow-y-auto">
      {messages.map((msg: Message) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}