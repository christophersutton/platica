import { useCallback, useState, useEffect } from 'react';
import { useWebSocket } from './use-websocket';
import { useWorkspace } from './use-workspace';

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
          // Add new entry
          return [...filtered, { userId, timestamp: Date.now() }];
        });
      }
    },
  });

  // Clean up typing indicators after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(user => now - user.timestamp < 3000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  const sendTypingIndicator = useCallback(() => {
    sendMessage({
      type: 'typing',
      channelId,
      userId: workspace?.id ?? 0
    });
  }, [sendMessage, channelId, workspace?.id]);

  return {
    sendTypingIndicator,
    typingUsers: typingUsers.map(u => u.userId)
  };
} 