import { useCallback, useMemo } from 'react';
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
      console.log('[WebSocket] Received message:', {
        message,
        propertyTypes: {
          type: typeof message.type,
          channelId: typeof message.channelId,
          content: typeof message.content,
          userId: typeof message.userId,
          messageId: typeof message.messageId,
          createdAt: typeof message.createdAt,
          sender_name: typeof message.sender_name,
          avatar_url: typeof message.avatar_url
        },
        expectedChannelId: channelId,
        channelIdComparison: {
          messageChannelId: message.channelId,
          expectedChannelId: channelId,
          isEqual: message.channelId === channelId
        }
      });
      
      // Type guard to ensure all required properties are present
      if (
        message.type === 'chat' && 
        message.channelId !== undefined &&
        typeof message.content === 'string' &&
        typeof message.userId === 'number' &&
        typeof message.messageId === 'number' &&
        typeof message.createdAt === 'number' &&
        typeof message.sender_name === 'string'
      ) {
        const messageChannelId = Number(message.channelId);
        const chatMessage = {
          ...message,
          channelId: messageChannelId
        } as WebSocketChatMessage;

        // Always update the messages cache for the channel that received the message
        queryClient.setQueryData(['channel-messages', messageChannelId], (oldData: Message[] | undefined) => {
          // If there's no existing data, don't initialize the cache
          // This ensures we'll fetch full history when switching to this channel
          if (!oldData) return undefined;

          const newMessage: Message = {
            id: chatMessage.messageId,
            content: chatMessage.content,
            userId: chatMessage.userId,
            channelId: chatMessage.channelId,
            createdAt: new Date(chatMessage.createdAt * 1000).toISOString(),
            threadId: chatMessage.threadId,
            sender_name: chatMessage.sender_name,
            avatar_url: chatMessage.avatar_url
          };
          
          // Check if message already exists
          if (oldData.some(msg => msg.id === newMessage.id)) {
            return oldData;
          }
          
          return [...oldData, newMessage];
        });

        // If the message is for another channel, update the unread flag
        if (messageChannelId !== channelId) {
          queryClient.setQueryData(['channels'], (oldChannels: Channel[] = []) => {
            return oldChannels.map(channel => {
              if (channel.id === messageChannelId) {
                return {
                  ...channel,
                  has_unread: 1
                };
              }
              return channel;
            });
          });
        }
      } else {
        console.log('[WebSocket] Message did not pass type guard:', {
          isChat: message.type === 'chat',
          hasChannelId: message.channelId !== undefined,
          channelIdType: typeof message.channelId,
          hasValidContent: typeof message.content === 'string',
          hasValidUserId: typeof message.userId === 'number',
          hasValidMessageId: typeof message.messageId === 'number',
          hasValidCreatedAt: typeof message.createdAt === 'number',
          hasValidSenderName: typeof message.sender_name === 'string',
          values: {
            type: message.type,
            channelId: message.channelId,
            content: message.content,
            userId: message.userId,
            messageId: message.messageId,
            createdAt: message.createdAt,
            sender_name: message.sender_name,
            avatar_url: message.avatar_url
          }
        });
      }
    },
    [channelId, queryClient]
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
          workspaceId: workspace.id,
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