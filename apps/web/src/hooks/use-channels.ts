import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Channel } from '@/lib/api';
import { useWebSocket } from './use-websocket';

export function useChannels(workspaceId: number) {
  const queryClient = useQueryClient();

  // Setup websocket connection to handle channel events
  useWebSocket({
    workspaceId,
    onChannelCreated: (channel: Channel) => {
      // Update the channels cache with the new channel
      queryClient.setQueryData(['channels', workspaceId], (old: { channels: Channel[] } | undefined) => {
        if (!old) return { channels: [channel] };
        return { channels: [...old.channels, channel] };
      });
    }
  });

  const {
    data: channels,
    isLoading,
    error,
    refetch: refreshChannels
  } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      try {
        const response = await api.channels.list(workspaceId);
        return response.channels;
      } catch (error) {
        console.error('Failed to fetch channels:', error);
        return [];
      }
    },
    enabled: Boolean(workspaceId),
  });

  const createChannel = useMutation({
    mutationFn: async (data: { name: string; description?: string; is_private?: boolean }) => {
      const response = await api.channels.create(workspaceId, data);
      return response.channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
    },
  });

  return {
    channels: channels || [],
    isLoading,
    error,
    createChannel: createChannel.mutateAsync,
    isCreating: createChannel.isPending,
    refreshChannels
  };
} 