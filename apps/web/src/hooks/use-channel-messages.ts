import { useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Channel } from '@/lib/api';
import { useWorkspace } from './use-workspace';
import { useWebSocket } from './use-websocket.ts';
import { useAuth } from './use-auth';

interface Message {
  id: number;
  content: string;
  userId: number;
  channelId: number;
  createdAt: string;
  created_at: number;
  threadId?: number;
  sender_name: string;
  avatar_url: string | null;
}

interface WebSocketChatMessage {
  type: 'chat';
  channelId: number;
  content: string;
  userId: number;
  messageId: number;
  createdAt: number;
  threadId?: number;
  sender_name: string;
  avatar_url: string | null;
}

export function useChannelMessages(channelId: number) {
  const queryClient = useQueryClient();
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const { user } = useAuth();

  // Mark channel as read when viewing it
  useEffect(() => {
    if (!channelId || !user?.id) return;

    const markChannelAsRead = async () => {
      try {
        await api.channels.markAsRead(channelId);
        // Update the unread status in the channels list
        if (workspace?.id) {
          queryClient.setQueryData(['channels', workspace.id], (old: { channels: Channel[] } | undefined) => {
            if (!old) return { channels: [] };
            return {
              channels: old.channels.map(channel => {
                if (channel.id === channelId) {
                  return {
                    ...channel,
                    has_unread: 0
                  };
                }
                return channel;
              })
            };
          });
        }
      } catch (error) {
        console.error('Failed to mark channel as read:', error);
      }
    };

    markChannelAsRead();
  }, [channelId, user?.id, queryClient, workspace?.id]);

  // Memoize the workspaceId to prevent unnecessary reconnections
  const workspaceId = useMemo(() => {
    if (isWorkspaceLoading || !workspace?.id) return 0;
    return workspace.id;
  }, [workspace?.id, isWorkspaceLoading]);

  // Fetch messages via REST
  const {
    data: messages = [],
    isLoading,
    error,
    dataUpdatedAt
  } = useQuery({
    queryKey: ['channel-messages', channelId],
    queryFn: async () => {
      if (!channelId || !workspace?.id) {
        return []; 
      }
      console.log('[REST] Fetching messages for channel:', channelId);
      const response = await api.channels.getMessages(channelId);
      console.log('[REST] Fetched messages:', response.messages.length);
      return response.messages;
    },
    enabled: Boolean(channelId && workspace?.id),
    staleTime: 0, // Allow refetching when channel changes
    refetchOnMount: true, // Ensure we refetch when switching channels
  });

  // Memoize the onMessage callback to handle websocket messages
  const onMessage = useCallback(
    (message: WebSocketChatMessage | { type: string }) => {
      if (!workspace?.id) {
        console.log('[WebSocket] No workspace ID available, skipping message processing');
        return;
      }

      const messageChannelId = 'channelId' in message ? Number(message.channelId) : 0;
      const currentChannelId = Number(channelId);
      
      // Type guard to ensure all required properties are present
      if (
        message.type === 'chat' && 
        'channelId' in message &&
        'content' in message &&
        'userId' in message &&
        'messageId' in message &&
        'createdAt' in message &&
        'sender_name' in message
      ) {
        // If message is for a different channel, update its unread status
        if (messageChannelId !== currentChannelId && message.userId !== user?.id) {
          queryClient.setQueryData(['channels', workspace.id], (old: { channels: Channel[] } | undefined) => {
            if (!old) return { channels: [] };
            return {
              channels: old.channels.map(channel => {
                if (channel.id === messageChannelId) {
                  return {
                    ...channel,
                    has_unread: 1,
                    last_message_at: message.createdAt
                  };
                }
                return channel;
              })
            };
          });
        }

        const messageTimestamp = message.createdAt * 1000; // Convert to milliseconds
        
        // Check if this message already exists in our cache
        const queryKey = ['channel-messages', messageChannelId];
        const existingData = queryClient.getQueryData<Message[]>(queryKey);
        
        // Enhanced deduplication check - look for messages with same content and timestamp within a 5 second window
        const messageExists = existingData?.some(m => {
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTimestamp);
          return (
            m.id === message.messageId || // Exact ID match
            (m.content === message.content && // Or same content
             m.userId === message.userId && // from same user
             timeDiff < 5000) // within 5 seconds
          );
        });

        if (!messageExists) {
          queryClient.setQueryData<Message[]>(queryKey, (oldData = []) => {
            // Convert the WebSocket message format to match our Message interface
            const newMessage: Message = {
              id: message.messageId,
              content: message.content,
              userId: message.userId,
              channelId: messageChannelId,
              createdAt: new Date(messageTimestamp).toISOString(),
              created_at: message.createdAt,
              threadId: message.threadId,
              sender_name: message.sender_name,
              avatar_url: message.avatar_url ?? null
            };
            
            return [...oldData, newMessage];
          });

          // Update last_message_at in channels list
          queryClient.setQueryData(['channels', workspace.id], (old: { channels: Channel[] } | undefined) => {
            if (!old) return { channels: [] };
            return {
              channels: old.channels.map(channel => {
                if (channel.id === messageChannelId) {
                  return {
                    ...channel,
                    last_message_at: message.createdAt
                  };
                }
                return channel;
              })
            };
          });
        }
      }
    },
    [channelId, queryClient, workspace?.id, dataUpdatedAt, user?.id]
  );

  // Initialize the websocket with stable values
  const { sendMessage: wsSend, isConnected } = useWebSocket({
    workspaceId,
    onMessage,
  });

  // Send a message (WebSocket only)
  const sendChannelMessage = useCallback(
    async (content: string) => {
      if (!channelId || !workspace?.id || !user?.id) {
        console.warn('[WebSocket] Cannot send message - missing channelId, workspaceId, or userId');
        return;
      }

      if (!isConnected) {
        console.warn('[WebSocket] Cannot send message - WebSocket not connected');
        return;
      }

      try {
        console.log('[WebSocket] Sending message to channel:', channelId);
        // Send via WebSocket
        wsSend({
          type: 'chat',
          channelId,
          content,
          userId: user.id
        });
        console.log('[WebSocket] Message sent successfully');
      } catch (err) {
        console.error('[WebSocket] Failed to send message:', err);
        throw err;
      }
    },
    [channelId, workspace?.id, user?.id, wsSend, isConnected]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage: sendChannelMessage,
    isSending: false,
    isWebSocketConnected: isConnected,
  };
}