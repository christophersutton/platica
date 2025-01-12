import type { User } from '@models/user';
import type { Hub, HubMember } from '@models/hub';
import type { ApiMessage, Message } from '@models/message';
import type { Workspace } from '@models/workspace';
import type { ApiWorkspaceUser } from '@models/user';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface ApiError {
  error: string;
  status: number;
}

const API_BASE_URL = '/api';

// List of endpoints that should not include auth header
const PUBLIC_ENDPOINTS = [
  '/auth/magic-link',
  '/auth/verify'
];

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isPublicEndpoint = PUBLIC_ENDPOINTS.some(e => endpoint.startsWith(e));
  const token = !isPublicEndpoint ? localStorage.getItem('auth_token') : null;
  
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
    requestMagicLink: (email: string, options?: { workspaceId?: string }) =>
      fetchApi<{ message: string; magicLink?: string; token?: string }>('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email, workspaceId: options?.workspaceId }),
      }),
    
    verifyToken: (token: string, options?: RequestInit) =>
      fetchApi<{ token: string; user: User; workspaceId?: number }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
        ...options,
      }),
      
    getProfile: () => 
      fetchApi<ApiWorkspaceUser>('/profile'),

    logout: () => {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    },
  },
  
  hubs: {
    list: (workspaceId: number) => 
      fetchApi<{ hubs: Hub[] }>(`/workspaces/${workspaceId}/hubs`),
    
    create: (workspaceId: number, data: { name: string; description?: string; is_private?: boolean }) =>
      fetchApi<{ hub
: Hub }>(`/workspaces/${workspaceId}/hubs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMessages: (hubId: number) =>
      fetchApi<{ messages: ApiMessage[] }>(`/hubs/${hubId}/messages`),

    markRead: (hubId: number) =>
      fetchApi<{ success: boolean }>(`/hubs/${hubId}/messages/read`, {
        method: 'POST'
      }),

    markAsRead: (hubId: number) =>
      fetchApi<void>(`/hubs/${hubId}/read`, {
        method: 'POST'
      }),

    members: {
      list: (hubId: number) =>
        fetchApi<{ members: HubMember[] }>(`/hubs/${hubId}/members`),

      add: (hubId: number, data: { userId: number; role?: string }) =>
        fetchApi<{ success: boolean }>(`/hubs/${hubId}/members`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      remove: (hubId: number, userId: number) =>
        fetchApi<{ success: boolean }>(`/hubs/${hubId}/members/${userId}`, {
          method: 'DELETE'
        }),

      update: (hubId: number, userId: number, data: { role: string }) =>
        fetchApi<{ success: boolean }>(`/hubs/${hubId}/members/${userId}`, {
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
export type { Message, User, Workspace, Hub, ApiWorkspaceUser };