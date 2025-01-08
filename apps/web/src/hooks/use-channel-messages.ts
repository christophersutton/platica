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
        // Invalidate the channels query to update unread status
        if (workspace?.id) {
          queryClient.invalidateQueries({ queryKey: ['channels', workspace.id] });
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

  // Memoize the onMessage callback to handle websocket messages
  const onMessage = useCallback(
    (message: { 
      type: string; 
      channelId?: number; 
      content?: string; 
      userId?: number; 
      messageId?: number; 
      createdAt?: number;
      sender_name?: string;
      avatar_url?: string | null;
    }) => {
      if (!workspace?.id) {
        console.log('[WebSocket] No workspace ID available, skipping message processing');
        return;
      }

      // Skip processing if we don't have a valid channel ID
      if (!channelId) {
        console.log('[WebSocket] No valid channel ID, skipping message processing');
        return;
      }

      const messageChannelId = Number(message.channelId);
      const currentChannelId = Number(channelId);
      
      console.log('[WebSocket] Processing message:', {
        message,
        currentChannelId,
        workspaceId: workspace.id,
        isCurrentChannel: messageChannelId === currentChannelId,
        messageChannelId
      });
      
      // Type guard to ensure all required properties are present
      if (
        message.type === 'chat' && 
        messageChannelId > 0 &&
        typeof message.content === 'string' &&
        typeof message.userId === 'number'
      ) {
        const chatMessage = {
          ...message,
          channelId: messageChannelId,
          messageId: message.messageId || Date.now(),
          createdAt: message.createdAt || new Date().toISOString(),
          sender_name: message.sender_name || 'Unknown'
        } as WebSocketChatMessage;

        // Update messages only if it's for the current channel
        if (messageChannelId === currentChannelId) {
          queryClient.setQueryData(['channel-messages', messageChannelId], (oldData: Message[] | undefined) => {
            if (!oldData) return undefined;

            const newMessage: Message = {
              id: chatMessage.messageId,
              content: chatMessage.content,
              userId: chatMessage.userId,
              channelId: chatMessage.channelId,
              createdAt: typeof chatMessage.createdAt === 'number' 
                ? new Date(chatMessage.createdAt * 1000).toISOString()
                : chatMessage.createdAt,
              threadId: chatMessage.threadId,
              sender_name: chatMessage.sender_name,
              avatar_url: chatMessage.avatar_url
            };
            
            if (oldData.some(msg => msg.id === newMessage.id)) {
              return oldData;
            }
            
            return [...oldData, newMessage];
          });
        } else {
          // Message is for another channel, update the unread flag
          console.log('[WebSocket] Message is for a different channel:', {
            messageChannelId,
            currentChannelId,
            workspaceId: workspace.id
          });
          
          // First try to get the current channels data
          const currentData = queryClient.getQueryData<{ channels: Channel[] }>(['channels', workspace.id]);
          
          if (!currentData) {
            console.log('[WebSocket] No channels data in cache, fetching fresh data');
            queryClient.invalidateQueries({ queryKey: ['channels', workspace.id] });
            return;
          }
          
          console.log('[WebSocket] Current channels data:', currentData);
          
          queryClient.setQueryData(['channels', workspace.id], {
            channels: currentData.channels.map(channel => {
              if (channel.id === messageChannelId) {
                console.log('[WebSocket] Marking channel as unread:', channel.id);
                return {
                  ...channel,
                  has_unread: 1,
                  last_message_at: chatMessage.createdAt
                };
              }
              return channel;
            })
          });
        }
      }
    },
    [channelId, queryClient, workspace?.id]
  );

  // Initialize the websocket with stable values
  const { sendMessage: wsSend, isConnected } = useWebSocket({
    workspaceId,
    onMessage,
  });

  // Fetch messages via REST
  const {
    data: messages = [],
    isLoading,
    error,
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
    staleTime: Infinity, // Don't refetch automatically since we'll handle updates via WebSocket
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