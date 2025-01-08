import { useCallback, useState, useEffect } from 'react';
import { useWebSocket } from './use-websocket';
import { useWorkspace } from './use-workspace';
import { WSEventType, type TypingMessage } from '@platica/shared/src/websocket';

interface TypingUser {
  userId: number;
  timestamp: number;
}

export function useTypingIndicator(channelId: number) {
  const { workspace } = useWorkspace();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const { sendMessage } = useWebSocket({
    workspaceId: workspace?.id ?? 0,
    onTypingIndicator: (messageChannelId, userId) => {
      if (messageChannelId === channelId) {
        setTypingUsers(prev => {
          // Remove existing entry for this user if it exists
          const filtered = prev.filter(u => u.userId !== userId);
          // Only add new entry if user is typing
          return [...filtered, { userId, timestamp: Date.now() }];
        });
      }
    },
  });

  // Clean up typing indicators after 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(user => now - user.timestamp < 2000));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const sendTypingIndicator = useCallback(() => {
    const message: TypingMessage = {
      type: WSEventType.TYPING,
      channelId,
      userId: workspace?.id ?? 0,
      isTyping: true
    };
    sendMessage(message);
  }, [sendMessage, channelId, workspace?.id]);

  const clearTypingIndicator = useCallback(() => {
    const message: TypingMessage = {
      type: WSEventType.TYPING,
      channelId,
      userId: workspace?.id ?? 0,
      isTyping: false
    };
    sendMessage(message);
  }, [sendMessage, channelId, workspace?.id]);

  return {
    sendTypingIndicator,
    clearTypingIndicator,
    typingUsers: typingUsers.map(u => u.userId)
  };
} 