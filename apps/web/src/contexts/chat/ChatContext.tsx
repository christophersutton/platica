import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { UiMessage } from '@models/message';
import type { User } from '@models/user';

interface ChatState {
  activeChats: Record<number, {
    messages: UiMessage[];
    isLoading: boolean;
    error: Error | null;
  }>;
  typing: Record<number, {
    isTyping: boolean;
    lastUpdate: number;
  }>;
  presence: Record<number, {
    isActive: boolean;
    lastSeen: number;
  }>;
}

type ChatAction =
  | { type: 'SET_CHAT_LOADING'; payload: number }
  | { type: 'SET_CHAT_MESSAGES'; payload: { chatId: number; messages: UiMessage[] } }
  | { type: 'SET_CHAT_ERROR'; payload: { chatId: number; error: Error } }
  | { type: 'ADD_MESSAGE'; payload: { chatId: number; message: UiMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { chatId: number; messageId: number; updates: Partial<UiMessage> } }
  | { type: 'SET_TYPING'; payload: { chatId: number; isTyping: boolean } }
  | { type: 'SET_PRESENCE'; payload: { userId: number; isActive: boolean; lastSeen: number } }
  | { type: 'CLEAR_CHAT'; payload: number };

const initialState: ChatState = {
  activeChats: {},
  typing: {},
  presence: {}
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CHAT_LOADING':
      return {
        ...state,
        activeChats: {
          ...state.activeChats,
          [action.payload]: {
            messages: [],
            isLoading: true,
            error: null
          }
        }
      };
    case 'SET_CHAT_MESSAGES':
      return {
        ...state,
        activeChats: {
          ...state.activeChats,
          [action.payload.chatId]: {
            messages: action.payload.messages,
            isLoading: false,
            error: null
          }
        }
      };
    case 'SET_CHAT_ERROR':
      return {
        ...state,
        activeChats: {
          ...state.activeChats,
          [action.payload.chatId]: {
            ...state.activeChats[action.payload.chatId],
            isLoading: false,
            error: action.payload.error
          }
        }
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        activeChats: {
          ...state.activeChats,
          [action.payload.chatId]: {
            ...state.activeChats[action.payload.chatId],
            messages: [
              ...state.activeChats[action.payload.chatId].messages,
              action.payload.message
            ]
          }
        }
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        activeChats: {
          ...state.activeChats,
          [action.payload.chatId]: {
            ...state.activeChats[action.payload.chatId],
            messages: state.activeChats[action.payload.chatId].messages.map(msg =>
              msg.id === action.payload.messageId
                ? { ...msg, ...action.payload.updates }
                : msg
            )
          }
        }
      };
    case 'SET_TYPING':
      return {
        ...state,
        typing: {
          ...state.typing,
          [action.payload.chatId]: {
            isTyping: action.payload.isTyping,
            lastUpdate: Date.now()
          }
        }
      };
    case 'SET_PRESENCE':
      return {
        ...state,
        presence: {
          ...state.presence,
          [action.payload.userId]: {
            isActive: action.payload.isActive,
            lastSeen: action.payload.lastSeen
          }
        }
      };
    case 'CLEAR_CHAT': {
      const { [action.payload]: _, ...remainingChats } = state.activeChats;
      return {
        ...state,
        activeChats: remainingChats
      };
    }
    default:
      return state;
  }
}

interface ChatContextValue {
  state: ChatState;
  loadChat: (chatId: number) => Promise<void>;
  sendMessage: (chatId: number, content: string) => Promise<void>;
  updateMessage: (chatId: number, messageId: number, updates: Partial<UiMessage>) => void;
  setTyping: (chatId: number, isTyping: boolean) => void;
  setPresence: (userId: number, isActive: boolean) => void;
  clearChat: (chatId: number) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: isAuthLoading } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const loadChat = useCallback(async (chatId: number) => {
    if (!token || isAuthLoading) return;
    dispatch({ type: 'SET_CHAT_LOADING', payload: chatId });
    try {
      // TODO: Implement chat API endpoint
      const messages = [] as UiMessage[]; // await api.chats.getMessages(chatId);
      dispatch({ type: 'SET_CHAT_MESSAGES', payload: { chatId, messages } });
    } catch (error) {
      dispatch({ type: 'SET_CHAT_ERROR', payload: { chatId, error: error as Error } });
    }
  }, [token, isAuthLoading]);

  const sendMessage = useCallback(async (chatId: number, content: string) => {
    if (!token || isAuthLoading) return;
    try {
      // TODO: Implement chat API endpoint
      // const message = await api.chats.sendMessage(chatId, content);
      // dispatch({ type: 'ADD_MESSAGE', payload: { chatId, message } });
    } catch (error) {
      dispatch({ type: 'SET_CHAT_ERROR', payload: { chatId, error: error as Error } });
    }
  }, [token, isAuthLoading]);

  const updateMessage = useCallback((chatId: number, messageId: number, updates: Partial<UiMessage>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { chatId, messageId, updates } });
  }, []);

  const setTyping = useCallback((chatId: number, isTyping: boolean) => {
    dispatch({ type: 'SET_TYPING', payload: { chatId, isTyping } });
  }, []);

  const setPresence = useCallback((userId: number, isActive: boolean) => {
    dispatch({
      type: 'SET_PRESENCE',
      payload: { userId, isActive, lastSeen: Date.now() }
    });
  }, []);

  const clearChat = useCallback((chatId: number) => {
    dispatch({ type: 'CLEAR_CHAT', payload: chatId });
  }, []);

  const value = {
    state,
    loadChat,
    sendMessage,
    updateMessage,
    setTyping,
    setPresence,
    clearChat
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 