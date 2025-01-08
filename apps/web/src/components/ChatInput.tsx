import { Button, Textarea } from "@/components/ui";
import { Bold, Italic, Link, Send } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useAuth } from "@/hooks/use-auth.ts";
import { useWorkspaceUsers } from "@/hooks/use-workspace-users";

interface ChatInputProps {
  channelId: number;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ channelId, onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { typingUsers, sendTypingIndicator, clearTypingIndicator } = useTypingIndicator(channelId);
  const { user } = useAuth();
  const { users } = useWorkspaceUsers();
  const [typingMessage, setTypingMessage] = useState<string | null>(null);
  const typingTimeoutRef = useRef<number>();

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

    const typingNames = otherTypingUsers
      .map(id => users.find(u => u.id === id)?.name || 'Someone')
      .join(', ');

    if (otherTypingUsers.length === 1) {
      setTypingMessage(`${typingNames} is typing...`);
    } else {
      setTypingMessage(`${typingNames} are typing...`);
    }
  }, [typingUsers, user, users]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      clearTypingIndicator();
      window.clearTimeout(typingTimeoutRef.current);
    }
  };

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Clear any existing timeout
    window.clearTimeout(typingTimeoutRef.current);
    
    // Only send typing indicator if there is actual content
    if (newMessage.trim()) {
      // Send typing indicator immediately
      sendTypingIndicator();
      
      // Set a timeout to clear the typing indicator after 2 seconds of no typing
      typingTimeoutRef.current = window.setTimeout(() => {
        clearTypingIndicator();
      }, 2000);
    } else {
      clearTypingIndicator();
    }
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Handle focus/blur events
  const handleFocus = () => {
    // Don't send typing indicator on focus
    // Only send when user actually types something
  };

  const handleBlur = () => {
    // Clear typing indicator when field loses focus
    clearTypingIndicator();
    window.clearTimeout(typingTimeoutRef.current);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(typingTimeoutRef.current);
      clearTypingIndicator();
    };
  }, [clearTypingIndicator]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="space-y-2">
      {typingMessage && (
        <div className="text-sm text-gray-500 italic px-3">
          {typingMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Message #general"
            className="w-full resize-none rounded-lg border border-gray-300 p-3 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            rows={2}
            disabled={disabled}
            style={{ minHeight: '66px', maxHeight: '200px' }}
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="h-[44px] rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
