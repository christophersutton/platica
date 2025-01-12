import type { ApiMessage } from '@platica/shared/src/models/message';

export function MessageItem({ message }: { message: ApiMessage }) {
  const senderName = message.sender?.name || `User ${message.sender?.id}`;
  const timestamp = new Date(message.createdAt * 1000).toLocaleTimeString();

  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-sm text-gray-600">
        <strong>{senderName}</strong> said:
      </div>
      <div>{message.content}</div>
      <div className="text-xs text-gray-400">{timestamp}</div>
    </div>
  );
}