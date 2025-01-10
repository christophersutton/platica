import { Button, Textarea } from "@/components/ui";
import { Bold, Italic, Link, Send } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMessages } from "@/contexts/message/MessageContext";
import { useWebSocket } from "@/contexts/websocket/WebSocketContext";
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
  const { status: wsStatus } = useWebSocket();
  const { sendMessage } = useMessages();
  const [isConnectionReady, setIsConnectionReady] = useState(false);

  // Monitor WebSocket status changes
  useEffect(() => {
    if (wsStatus === 'connected' && !isConnectionReady) {
      // Add a small delay to ensure WS is fully ready
      const timer = setTimeout(() => {
        setIsConnectionReady(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (wsStatus !== 'connected' && isConnectionReady) {
      setIsConnectionReady(false);
    }
  }, [isConnectionReady, wsStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      sendMessage(channelId, message.trim());
      setMessage("");
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
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Add connection status check
  const isDisabled = disabled || wsStatus !== 'connected';

  return (
    <div className="space-y-2">
      {wsStatus !== 'connected' && (
        <div className="text-sm text-yellow-600 italic px-3">
          {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isDisabled ? 
              "Reconnecting to chat..." : 
              `Message #${channelId}`
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
