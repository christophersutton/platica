import { useCallback, useEffect, useState } from 'react'
import { useChannels } from './ChannelContext'
import { useWebSocket } from '../websocket/WebSocketContext'
import { useAuth } from '../AuthContext'
import { api } from '@/lib/api'
import { WSEventType } from '@platica/shared/src/websockets'
import type { ChannelMemberEvent } from '@platica/shared/src/websockets'
import type { ChannelMember, ChannelMemberRole } from '@platica/shared/src/models/channel'
import type { 
  ChatEvent,
  TypingEvent,
  WebSocketEvent
} from '@platica/shared/src/websockets'
import { getCurrentUnixTimestamp } from '@platica/shared/src/utils/time'

/**
 * Hook to manage subscription to a channel - handles active state, 
 * unread counts, and auto-subscription to WebSocket events
 */
export function useChannelSubscription(channelId: number | null) {
  const { setActiveChannel, markChannelAsRead, getChannelById } = useChannels()
  const { user } = useAuth()
  const { subscribe } = useWebSocket()
  
  useEffect(() => {
    if (!channelId) return
    
    setActiveChannel(channelId)
    markChannelAsRead(channelId)

    // Subscribe to relevant WS events for this channel
    const unsubscribeMessage = subscribe(WSEventType.CHAT, (event: WebSocketEvent) => {
      if (event.type !== WSEventType.CHAT) return
      const message = (event as ChatEvent).payload.message
      if (message.channelId === channelId) {
        // Only mark as read if it's from the current user
        if (message.sender.id === user?.id) {
          markChannelAsRead(channelId)
        }
      }
    })

    return () => {
      setActiveChannel(null)
      unsubscribeMessage()
    }
  }, [channelId, setActiveChannel, markChannelAsRead, subscribe, user?.id])

  const channel = channelId ? getChannelById(channelId) : undefined
  const isUnread = channel?.unreadCount ?? 0 > 0

  return {
    channel,
    isUnread,
    markAsRead: () => channelId && markChannelAsRead(channelId)
  }
}

/**
 * Hook to manage channel members - handles loading, adding, removing members
 * and keeping member list in sync with WebSocket events
 */
export function useChannelMembers(channelId: number | null) {
  const { subscribe } = useWebSocket()
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadMembers = useCallback(async () => {
    if (!channelId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.channels.members.list(channelId)
      setMembers(response.members)
    } catch (err) {
      setError(err as Error)
      console.error('Failed to load channel members:', err)
    } finally {
      setLoading(false)
    }
  }, [channelId])

  const addMember = useCallback(async (userId: number, role: string = 'member') => {
    if (!channelId) return
    
    try {
      await api.channels.members.add(channelId, { userId, role })
      setMembers(prev => [...prev, { id: userId, role, channelId } as ChannelMember])
    } catch (err) {
      console.error('Failed to add channel member:', err)
      throw err
    }
  }, [channelId])

  const removeMember = useCallback(async (userId: number) => {
    if (!channelId) return
    
    try {
      await api.channels.members.remove(channelId, userId)
      setMembers(prev => prev.filter(m => m.id !== userId))
    } catch (err) {
      console.error('Failed to remove channel member:', err)
      throw err
    }
  }, [channelId])

  useEffect(() => {
    if (!channelId) return
    
    loadMembers()

    // Subscribe to member-related WebSocket events
    const unsubscribeTyping = subscribe(WSEventType.TYPING, (event: WebSocketEvent) => {
      if (event.type !== WSEventType.TYPING) return
      const msg = (event as TypingEvent).payload
      if (msg.channelId === channelId) {
        setMembers(prev => {
          if (msg.isTyping) {
            return prev.map(m => m.userId === msg.userId ? { ...m, isTyping: true } : m)
          } else {
            return prev.map(m => m.userId === msg.userId ? { ...m, isTyping: false } : m)
          }
        })
      }
    })

    return () => {
      unsubscribeTyping()
    }
  }, [channelId, subscribe])

  useEffect(() => {
    if (!channelId) return;

    const handlers = {
      [WSEventType.CHANNEL_MEMBER_ADDED]: (message: WebSocketEvent) => {
        if (message.type !== WSEventType.CHANNEL_MEMBER_ADDED) return;
        const event = message as ChannelMemberEvent;
        if (event.channelId !== channelId) return;
        const now = getCurrentUnixTimestamp();
        setMembers(prev => [...prev, { 
          id: event.userId, 
          role: (event.role || 'member') as ChannelMemberRole, 
          channelId,
          createdAt: now,
          updatedAt: now,
          lastReadAt: now,
          settings: {}
        } as ChannelMember]);
      },
      
      [WSEventType.CHANNEL_MEMBER_REMOVED]: (message: WebSocketEvent) => {
        if (message.type !== WSEventType.CHANNEL_MEMBER_REMOVED) return;
        const event = message as ChannelMemberEvent;
        if (event.channelId !== channelId) return;
        setMembers(prev => prev.filter(m => m.id !== event.userId));
      },
      
      [WSEventType.CHANNEL_MEMBER_UPDATED]: (message: WebSocketEvent) => {
        if (message.type !== WSEventType.CHANNEL_MEMBER_UPDATED) return;
        const event = message as ChannelMemberEvent;
        if (event.channelId !== channelId) return;
        const now = getCurrentUnixTimestamp();
        setMembers(prev => prev.map(m => 
          m.id === event.userId 
            ? { ...m, role: event.role as ChannelMemberRole || m.role, updatedAt: now }
            : m
        ));
      }
    };

    const unsubscribes = Object.entries(handlers).map(([eventType, handler]) => 
      subscribe(eventType as WSEventType, handler)
    );

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [channelId, subscribe]);

  return {
    members,
    loading,
    error,
    addMember,
    removeMember,
    loadMembers
  }
}

/**
 * Hook for managing channel-specific UI operations - handles typing indicators,
 * online status, and other UI state
 */
export function useChannelUI(channelId: number | null) {
  const { subscribe } = useWebSocket()
  const [typingUsers, setTypingUsers] = useState<number[]>([])
  
  useEffect(() => {
    if (!channelId) return
    
    const unsubscribeTyping = subscribe(WSEventType.TYPING, (event: WebSocketEvent) => {
      if (event.type !== WSEventType.TYPING) return
      const msg = (event as TypingEvent).payload
      if (msg.channelId === channelId) {
        setTypingUsers(prev => {
          if (msg.isTyping) {
            return prev.includes(msg.userId) ? prev : [...prev, msg.userId]
          } else {
            return prev.filter(id => id !== msg.userId)
          }
        })
      }
    })

    // Clear typing indicators after timeout
    const interval = setInterval(() => {
      const now = getCurrentUnixTimestamp()
      setTypingUsers(prev => {
        // In a real implementation, we'd track timestamps per user
        // This is simplified for the example
        return prev
      })
    }, 3000)

    return () => {
      unsubscribeTyping()
      clearInterval(interval)
    }
  }, [channelId, subscribe])

  return {
    typingUsers
  }
}