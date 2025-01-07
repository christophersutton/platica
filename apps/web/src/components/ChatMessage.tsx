import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  id: number;
  message: string;
  sender: string;
  timestamp: string;
  avatar: string;
  isTyping?: boolean;
}

export function ChatMessage({ message, sender, timestamp, avatar, isTyping }: ChatMessageProps) {
  return (
    <div className="flex items-start gap-3">
      <img src={avatar} alt={sender} className="w-10 h-10 rounded-full" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{sender}</span>
          {!isTyping && <span className="text-xs text-gray-500">{timestamp}</span>}
        </div>
        {isTyping ? (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <p className="text-gray-900">{message}</p>
        )}
      </div>
    </div>
  );
}