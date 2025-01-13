import { ApiMessage } from "@platica/shared/models";

export function MessageItem({ message }: { message: ApiMessage }) {
  const senderName = message.sender?.name || `User ${message.sender?.id}`;
  const timestamp = new Date(message.createdAt * 1000).toLocaleTimeString();
  
  return (
    <div className="group flex items-start gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors">
      {message.sender?.avatarUrl ? (
        <img 
          src={message.sender.avatarUrl} 
          alt={senderName}
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          {senderName[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{senderName}</span>
          <span className="text-xs text-gray-400">{timestamp}</span>
        </div>
        <div className="mt-1 text-gray-900">{message.content}</div>
      </div>
    </div>
  );
}