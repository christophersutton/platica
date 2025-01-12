import { useGetRoomMessagesQuery } from '../api';
import type { ApiMessage } from '@platica/shared/src/models/message';
import { MessageItem } from './MessageItem';

interface MessagesListProps {
  roomId: string;
}

export function MessagesList({ roomId }: MessagesListProps) {
  const { data: messages, isLoading, isError } = useGetRoomMessagesQuery(roomId);

  if (isLoading) return <div>Loading messages...</div>;
  if (isError) return <div>Failed to load messages.</div>;
  if (!messages) return <div>No messages found.</div>;

  return (
    <div className="flex flex-col space-y-2 p-2 border rounded h-64 overflow-y-auto">
      {messages.map((msg: ApiMessage) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}