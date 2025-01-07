import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Link, Send } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useAuth } from "@/hooks/use-auth.ts";

interface ChatInputProps {
  channelId: number;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ channelId, onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const { typingUsers, sendTypingIndicator } = useTypingIndicator(channelId);
  const { user } = useAuth();
  const [typingMessage, setTypingMessage] = useState<string | null>(null);

  // Debounce typing indicator
  const debouncedSendTyping = useCallback(() => {
    let timeout: number;
    return () => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        sendTypingIndicator();
      }, 500);
    };
  }, [sendTypingIndicator])();

  // Handle typing indicator message
  useEffect(() => {
    if (!user || typingUsers.length === 0) {
      setTypingMessage(null);
      return;
    }

    // Filter out current user
    const otherTypingUsers = typingUsers.filter(id => id !== user.id);
    if (otherTypingUsers.length === 0) {
      setTypingMessage(null);
      return;
    }

    if (otherTypingUsers.length === 1) {
      setTypingMessage("Someone is typing...");
    } else {
      setTypingMessage("Several people are typing...");
    }
  }, [typingUsers, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    debouncedSendTyping();
  };

  return (
    <div className="space-y-2">
      {typingMessage && (
        <div className="text-sm text-gray-500 italic px-3">
          {typingMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            value={message}
            onChange={handleChange}
            placeholder="Message #general"
            className="w-full resize-none rounded-lg border border-gray-300 p-3 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            rows={1}
            disabled={disabled}
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}