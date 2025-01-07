import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: string;
  sender: string;
  timestamp: string;
  avatar?: string;
  className?: string;
}

export function ChatMessage({ message, sender, timestamp, avatar, className }: ChatMessageProps) {
  return (
    <div className={cn("flex items-start space-x-4 p-4 hover:bg-gray-50 animate-message-appear", className)}>
      <Avatar className="h-10 w-10">
        <AvatarImage src={avatar} />
        <AvatarFallback>{sender[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center">
          <span className="font-semibold text-slack-text">{sender}</span>
          <span className="ml-2 text-sm text-gray-500">{timestamp}</span>
        </div>
        <p className="text-slack-text">{message}</p>
      </div>
    </div>
  );
}