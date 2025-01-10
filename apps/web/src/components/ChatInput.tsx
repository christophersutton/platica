import { Button, Textarea } from "@/components/ui";
import { Bold, Italic, Link, Send } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppContext } from "@/contexts/AppContext";
import type { Channel } from '@models/channel'

interface ChatInputProps {
  channelId: Channel['id'];
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ channelId, onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { state, sendTypingIndicator, clearTypingIndicator } = useAppContext();
  const [typingMessage, setTypingMessage] = useState<string | null>(null);
  const typingTimeoutRef = useRef<number>();
  const [isConnectionReady, setIsConnectionReady] = useState(false);

  // Get typing users for this channel
  const typingUsers = state.typingMap[channelId] || [];

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

    // For now just show number of people typing since we don't have user details in state yet
    if (otherTypingUsers.length === 1) {
      setTypingMessage(`Someone is typing...`);
    } else {
      setTypingMessage(`${otherTypingUsers.length} people are typing...`);
    }
  }, [typingUsers, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      clearTypingIndicator(channelId);
      window.clearTimeout(typingTimeoutRef.current);
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Monitor WebSocket status changes
  useEffect(() => {
    if (state.wsStatus === 'connected' && !isConnectionReady) {
      // Add a small delay to ensure WS is fully ready
      const timer = setTimeout(() => {
        setIsConnectionReady(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (state.wsStatus !== 'connected' && isConnectionReady) {
      setIsConnectionReady(false);
    }
  }, [isConnectionReady, state.wsStatus]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Clear any existing timeout
    window.clearTimeout(typingTimeoutRef.current);
    
    // Only send typing indicator if there is actual content AND connection is fully ready
    if (newMessage.trim() && isConnectionReady) {
      try {
        sendTypingIndicator(channelId);
        
        typingTimeoutRef.current = window.setTimeout(() => {
          if (isConnectionReady) {
            clearTypingIndicator(channelId);
          }
        }, 2000);
      } catch (error) {
        console.warn('Failed to send typing indicator:', error);
      }
    } else if (isConnectionReady) {
      try {
        clearTypingIndicator(channelId);
      } catch (error) {
        console.warn('Failed to clear typing indicator:', error);
      }
    }
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Handle focus/blur events
  const handleBlur = () => {
    if (isConnectionReady) {
      try {
        clearTypingIndicator(channelId);
        window.clearTimeout(typingTimeoutRef.current);
      } catch (error) {
        console.warn('Failed to clear typing indicator on blur:', error);
      }
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(typingTimeoutRef.current);
      if (isConnectionReady) {
        try {
          clearTypingIndicator(channelId);
        } catch (error) {
          console.warn('Failed to clear typing indicator on unmount:', error);
        }
      }
    };
  }, [channelId, clearTypingIndicator, isConnectionReady]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Add connection status check
  const isDisabled = disabled || state.wsStatus !== 'connected';

  return (
    <div className="space-y-2">
      {state.wsStatus !== 'connected' && (
        <div className="text-sm text-yellow-600 italic px-3">
          {state.wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </div>
      )}
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
            onBlur={handleBlur}
            placeholder={isDisabled ? 
              "Reconnecting to chat..." : 
              `Message ${state.channels.find(c => c.id === channelId)?.name || ''}`
            }
            className="w-full resize-none rounded-lg border border-gray-300 p-3 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            rows={2}
            disabled={isDisabled}
            style={{ minHeight: '66px', maxHeight: '200px' }}
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || isDisabled}
          className="h-[44px] rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
