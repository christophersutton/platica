const API_BASE_URL = '/api';

export interface Channel {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  member_count?: number;
  message_count?: number;
  last_message_at?: number | null;
  has_unread?: number;
  member_status?: 'member' | 'invited' | null;
}

interface Message {
  id: number;
  content: string;
  sender_id: number;
  sender_name: string;
  avatar_url: string | null;
  created_at: number;
  is_edited: boolean;
  thread_id?: number;
}

interface User {
  id: number;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface Workspace {
  id: number;
  name: string;
  slug: string;
  owner_id: number;
  icon_url: string | null;
  settings: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  member_count: number;
  channel_count: number;
  role: string;
}

interface WorkspaceUser {
  workspace_id: number;
  user_id: number;
  role: string;
  settings: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
}

interface ApiError {
  error: string;
  status: number;
}

interface ApiResponse<T> {
  data: T;
  error?: string;
}

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
      fetchApi<User>('/profile'),

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
      fetchApi<{ messages: Message[] }>(`/channels/${channelId}/messages`),

    sendMessage: (channelId: number, data: { content: string; thread_id?: number; }) =>
      fetchApi<{ message: Message }>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    markRead: (channelId: number) =>
      fetchApi<{ success: boolean }>(`/channels/${channelId}/messages/read`, {
        method: 'POST'
      }),

    markAsRead: (channelId: number) =>
      fetchApi<void>(`/channels/${channelId}/read`, {
        method: 'POST'
      }),
  },

  workspaces: {
    get: (workspaceId: number) =>
      fetchApi<Workspace>(`/workspaces/${workspaceId}`),
    
    list: () =>
      fetchApi<{ workspaces: Workspace[] }>('/workspaces'),

    getUsers: (workspaceId: number) =>
      fetchApi<WorkspaceUser[]>(`/workspaces/${workspaceId}/users`),
  },
};

export type { ApiError, Message, User, Workspace };