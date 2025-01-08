import { useCallback, useState, useEffect } from 'react';
import { useWebSocket } from './use-websocket';
import { useWorkspace } from './use-workspace';
import { useAuth } from './use-auth';
import { WSEventType, type TypingMessage } from '@platica/shared/src/websocket';

interface TypingUser {
  userId: number;
  timestamp: number;
}

export function useTypingIndicator(channelId: number) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const { sendMessage } = useWebSocket({
    workspaceId: workspace?.id ?? 0,
    onTypingIndicator: (messageChannelId, userId, isTyping) => {
      // Only process typing indicators for the current channel
      if (messageChannelId !== channelId) return;
      
      setTypingUsers(prev => {
        // Remove existing entry for this user
        const filtered = prev.filter(u => u.userId !== userId);
        // Only add new entry if user is typing
        return isTyping ? [...filtered, { userId, timestamp: Date.now() }] : filtered;
      });
    },
    onMessage: (message) => {
      // If we receive a chat message, immediately remove typing indicator for that user
      if (message.type === 'chat' && message.channelId === channelId) {
        setTypingUsers(prev => prev.filter(u => u.userId !== message.userId));
      }
    }
  });

  // Clean up typing indicators after 2 seconds of no updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(user => now - user.timestamp < 2000));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const sendTypingIndicator = useCallback(() => {
    if (!user?.id) return;
    
    const message: TypingMessage = {
      type: WSEventType.TYPING,
      channelId,
      userId: user.id,
      isTyping: true
    };
    sendMessage(message);
  }, [user?.id, channelId, sendMessage]);

  const clearTypingIndicator = useCallback(() => {
    if (!user?.id) return;
    
    const message: TypingMessage = {
      type: WSEventType.TYPING,
      channelId,
      userId: user.id,
      isTyping: false
    };
    sendMessage(message);
  }, [user?.id, channelId, sendMessage]);

  // Clear typing indicator when unmounting or changing channels
  useEffect(() => {
    return () => {
      clearTypingIndicator();
    };
  }, [clearTypingIndicator, channelId]);

  return {
    typingUsers: typingUsers.map(u => u.userId),
    sendTypingIndicator,
    clearTypingIndicator
  };
} 