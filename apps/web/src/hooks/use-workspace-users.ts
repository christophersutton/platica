import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePresence } from './use-presence';
import { useWorkspace } from './use-workspace';
import { useMemo } from 'react';

interface WorkspaceUserWithPresence {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  isOnline: boolean;
}

export function useWorkspaceUsers() {
  const { workspace } = useWorkspace();
  const { presenceMap } = usePresence();
  
  const {
    data: baseUsers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['workspace-users', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const response = await api.workspaces.getUsers(workspace.id);
      return response.map(user => ({
        id: user.user_id,
        name: user.user_name,
        email: user.user_email,
        avatar_url: user.user_avatar_url,
        role: user.role,
      }));
    },
    enabled: Boolean(workspace?.id),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus since we use WebSocket for updates
  });

  // Combine base user data with presence information
  const users = useMemo(() => {
    return baseUsers.map(user => ({
      ...user,
      isOnline: presenceMap[user.id]?.status === 'online'
    })) as WorkspaceUserWithPresence[];
  }, [baseUsers, presenceMap]);

  return {
    users,
    isLoading,
    error,
  };
} 