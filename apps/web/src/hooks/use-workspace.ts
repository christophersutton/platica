import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type Workspace } from '@/lib/api';
import { useAuth } from './use-auth';

export function useWorkspace() {
  const { workspaceId } = useParams();
  const parsedId = workspaceId ? Number(workspaceId) : undefined;
  const { user, token, isLoading: isAuthLoading } = useAuth();
  
  const {
    data: workspace,
    isLoading: isWorkspaceLoading,
    error,
  } = useQuery<Workspace>({
    queryKey: ['workspace', parsedId],
    queryFn: async () => {
      if (!parsedId || !token) {
        throw new Error('Invalid workspace ID or not authenticated');
      }
      const workspace = await api.workspaces.get(parsedId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }
      return workspace;
    },
    enabled: Boolean(parsedId) && Boolean(token) && !isAuthLoading,
    retry: false,
  });

  return {
    workspace,
    isLoading: isWorkspaceLoading || isAuthLoading,
    error,
  };
} 