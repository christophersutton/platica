import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui";
import { SafeTimestamp } from "@/components/ui/SafeTimestamp";
import { cn } from "@/lib/utils";
import type { UiMessage } from '@models/message';

interface ChatMessageProps {
  message: UiMessage;
  isTyping?: boolean;
  isSelf?: boolean;
}

export function ChatMessage({ message, isTyping, isSelf }: ChatMessageProps) {
  return (
    <div className={cn("flex items-start gap-3", isSelf && "flex-row-reverse")}>
      <img src={message.sender.avatarUrl || ''} alt={message.sender.name} className="w-10 h-10 rounded-full" />
      <div className={cn("flex-1 min-w-0", isSelf && "text-right")}>
        <div className={cn("flex items-baseline gap-2", isSelf && "flex-row-reverse")}>
          <span className="font-medium">{message.sender.name}</span>
          {!isTyping && message.createdAt && (
            <SafeTimestamp 
              timestamp={message.createdAt} 
              className="text-xs text-gray-500" 
              format="relative"
            />
          )}
        </div>
        {isTyping ? (
          <div className={cn("flex items-center gap-1", isSelf && "justify-end")}>
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <p className={cn(
            "inline-block text-gray-900 px-4 py-2 rounded-lg",
            isSelf ? "bg-purple-600 text-white" : "bg-gray-100"
          )}>
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}