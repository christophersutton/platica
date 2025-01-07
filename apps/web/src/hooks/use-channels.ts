import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Channel } from '@/lib/api';

export function useChannels(workspaceId: number) {
  const queryClient = useQueryClient();

  const {
    data: channels,
    isLoading,
    error,
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
    mutationFn: (data: { name: string; description?: string; is_private?: boolean }) =>
      api.channels.create(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
    },
  });

  return {
    channels: channels || [],
    isLoading,
    error,
    createChannel: createChannel.mutate,
    isCreating: createChannel.isPending,
  };
} 