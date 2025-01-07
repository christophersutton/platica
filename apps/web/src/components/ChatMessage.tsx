import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  id: number;
  message: string;
  sender: string;
  timestamp: string;
  avatar: string;
  isTyping?: boolean;
  isSelf?: boolean;
}

export function ChatMessage({ message, sender, timestamp, avatar, isTyping, isSelf }: ChatMessageProps) {
  return (
    <div className={cn("flex items-start gap-3", isSelf && "flex-row-reverse")}>
      <img src={avatar} alt={sender} className="w-10 h-10 rounded-full" />
      <div className={cn("flex-1 min-w-0", isSelf && "text-right")}>
        <div className={cn("flex items-baseline gap-2", isSelf && "flex-row-reverse")}>
          <span className="font-medium">{sender}</span>
          {!isTyping && <span className="text-xs text-gray-500">{timestamp}</span>}
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
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
