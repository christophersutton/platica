import { useState, useEffect } from 'react';
import { api, type User } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token'),
    isLoading: true,
    isInitialized: false,
    error: null,
  });

  // Load user profile only once on mount
  useEffect(() => {
    let mounted = true;
    
    const loadUser = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        if (mounted) {
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            isInitialized: true 
          }));
        }
        return;
      }

      try {
        const user = await api.auth.getProfile();
        if (mounted) {
          setState(prev => ({
            ...prev,
            user,
            token, // Ensure token is set
            isLoading: false,
            isInitialized: true,
            error: null,
          }));
        }
      } catch (error) {
        console.error('Auth error:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            user: null,
            token: null,
            isLoading: false,
            isInitialized: true,
            error: error as Error,
          }));
          localStorage.removeItem('auth_token');
        }
        if (mounted && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []); // Only run on mount

  const login = async (token: string) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      localStorage.setItem('auth_token', token);
      const user = await api.auth.getProfile();
      setState(prev => ({
        ...prev,
        user,
        token,
        isLoading: false,
        isInitialized: true,
        error: null,
      }));
      return true;
    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('auth_token');
      setState(prev => ({
        ...prev,
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
        error: error as Error,
      }));
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setState(prev => ({
      ...prev,
      user: null,
      token: null,
      isLoading: false,
      isInitialized: true,
      error: null,
    }));
    api.auth.logout();
  };

  return {
    ...state,
    login,
    logout,
  };
} 