import type { User } from '@models/user';
import type { Channel, ChannelMember } from '@models/channel';
import type { ApiMessage, Message } from '@models/message';
import type { Workspace } from '@models/workspace';
import type { ApiWorkspaceUser } from '@models/user';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface ApiError {
  error: string;
  status: number;
}

const API_BASE_URL = '/api';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const result = await response.json() as ApiResponse<T>;

  if (!response.ok) {
    throw {
      error: result.error || 'An error occurred',
      status: response.status,
    } as ApiError;
  }

  return result.data;
}

export const api = {
  auth: {
    requestMagicLink: (email: string) =>
      fetchApi<{ message: string; magicLink?: string; token?: string }>('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    
    verifyToken: (token: string) =>
      fetchApi<{ token: string; user: User }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
      
    getProfile: () => 
      fetchApi<ApiWorkspaceUser>('/profile'),

    logout: () => {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    },
  },
  
  channels: {
    list: (workspaceId: number) => 
      fetchApi<{ channels: Channel[] }>(`/workspaces/${workspaceId}/channels`),
    
    create: (workspaceId: number, data: { name: string; description?: string; is_private?: boolean }) =>
      fetchApi<{ channel: Channel }>(`/workspaces/${workspaceId}/channels`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMessages: (channelId: number) =>
      fetchApi<{ messages: ApiMessage[] }>(`/channels/${channelId}/messages`),

    markRead: (channelId: number) =>
      fetchApi<{ success: boolean }>(`/channels/${channelId}/messages/read`, {
        method: 'POST'
      }),

    markAsRead: (channelId: number) =>
      fetchApi<void>(`/channels/${channelId}/read`, {
        method: 'POST'
      }),

    members: {
      list: (channelId: number) =>
        fetchApi<{ members: ChannelMember[] }>(`/channels/${channelId}/members`),

      add: (channelId: number, data: { userId: number; role?: string }) =>
        fetchApi<{ success: boolean }>(`/channels/${channelId}/members`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      remove: (channelId: number, userId: number) =>
        fetchApi<{ success: boolean }>(`/channels/${channelId}/members/${userId}`, {
          method: 'DELETE'
        }),

      update: (channelId: number, userId: number, data: { role: string }) =>
        fetchApi<{ success: boolean }>(`/channels/${channelId}/members/${userId}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        })
    }
  },

  workspaces: {
    get: (workspaceId: number) =>
      fetchApi<Workspace>(`/workspaces/${workspaceId}`),
    
    list: () =>
      fetchApi<{ workspaces: Workspace[] }>('/workspaces'),

    getUsers: (workspaceId: number) =>
      fetchApi<ApiWorkspaceUser[]>(`/workspaces/${workspaceId}/users`),
  },
};

// Export types that other components might need
export type { ApiError, Message, User, Workspace, Channel, ApiWorkspaceUser };