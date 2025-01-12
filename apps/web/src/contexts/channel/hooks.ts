import { useCallback, useEffect, useState } from 'react'
import { useHubs } from './HubContext'
import { useWebSocket } from '../websocket/WebSocketContext'
import { useAuth } from '../AuthContext'
import { api } from '@/lib/api'
import { WSEventType } from '@platica/shared/src/websockets'
import type { HubMemberEvent } from '@platica/shared/src/websockets'
import type { HubMember, HubMemberRole } from '@platica/shared/src/models/hub
'
import type { 
  ChatEvent,
  TypingEvent,
  WebSocketEvent
} from '@platica/shared/src/websockets'
import { getCurrentUnixTimestamp } from '@platica/shared/src/utils/time'

/**
 * Hook to manage subscription to a hub
 - handles active state, 
 * unread counts, and auto-subscription to WebSocket events
 */
export function useHubSubscription(hubId: number | null) {
  const { setActiveHub, markHubAsRead, getHubById } = useHubs()
  const { user } = useAuth()
  const { subscribe } = useWebSocket()
  
  useEffect(() => {
    if (!hubId) return
    
    setActiveHub(hubId)
    markHubAsRead(hubId)

    // Subscribe to relevant WS events for this hub

    const unsubscribeMessage = subscribe(WSEventType.CHAT, (event: WebSocketEvent) => {
      if (event.type !== WSEventType.CHAT) return
      const message = (event as ChatEvent).payload.message
      if (message.hubId === hubId) {
        // Only mark as read if it's from the current user
        if (message.sender.id === user?.id) {
          markHubAsRead(hubId)
        }
      }
    })

    return () => {
      setActiveHub(null)
      unsubscribeMessage()
    }
  }, [hubId, setActiveHub, markHubAsRead, subscribe, user?.id])

  const hub
 = hubId ? getHubById(hubId) : undefined
  const isUnread = hub
?.unreadCount ?? 0 > 0

  return {
    hub
,
    isUnread,
    markAsRead: () => hubId && markHubAsRead(hubId)
  }
}

/**
 * Hook to manage hub
 members - handles loading, adding, removing members
 * and keeping member list in sync with WebSocket events
 */
export function useHubMembers(hubId: number | null) {
  const { subscribe } = useWebSocket()
  const [members, setMembers] = useState<HubMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadMembers = useCallback(async () => {
    if (!hubId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.hubs.members.list(hubId)
      setMembers(response.members)
    } catch (err) {
      setError(err as Error)
      console.error('Failed to load hub
 members:', err)
    } finally {
      setLoading(false)
    }
  }, [hubId])

  const addMember = useCallback(async (userId: number, role: string = 'member') => {
    if (!hubId) return
    
    try {
      await api.hubs.members.add(hubId, { userId, role })
      setMembers(prev => [...prev, { id: userId, role, hubId } as HubMember])
    } catch (err) {
      console.error('Failed to add hub
 member:', err)
      throw err
    }
  }, [hubId])

  const removeMember = useCallback(async (userId: number) => {
    if (!hubId) return
    
    try {
      await api.hubs.members.remove(hubId, userId)
      setMembers(prev => prev.filter(m => m.id !== userId))
    } catch (err) {
      console.error('Failed to remove hub
 member:', err)
      throw err
    }
  }, [hubId])

  useEffect(() => {
    if (!hubId) return
    
    loadMembers()

    // Subscribe to member-related WebSocket events
    const unsubscribeTyping = subscribe(WSEventType.TYPING, (event: WebSocketEvent) => {
      if (event.type !== WSEventType.TYPING) return
      const msg = (event as TypingEvent).payload
      if (msg.hubId === hubId) {
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
  }, [hubId, subscribe])

  useEffect(() => {
    if (!hubId) return;

    const handlers = {
      [WSEventType.CHANNEL_MEMBER_ADDED]: (message: WebSocketEvent) => {
        if (message.type !== WSEventType.CHANNEL_MEMBER_ADDED) return;
        const event = message as HubMemberEvent;
        if (event.hubId !== hubId) return;
        const now = getCurrentUnixTimestamp();
        setMembers(prev => [...prev, { 
          id: event.userId, 
          role: (event.role || 'member') as HubMemberRole, 
          hubId,
          createdAt: now,
          updatedAt: now,
          lastReadAt: now,
          settings: {}
        } as HubMember]);
      },
      
      [WSEventType.CHANNEL_MEMBER_REMOVED]: (message: WebSocketEvent) => {
        if (message.type !== WSEventType.CHANNEL_MEMBER_REMOVED) return;
        const event = message as HubMemberEvent;
        if (event.hubId !== hubId) return;
        setMembers(prev => prev.filter(m => m.id !== event.userId));
      },
      
      [WSEventType.CHANNEL_MEMBER_UPDATED]: (message: WebSocketEvent) => {
        if (message.type !== WSEventType.CHANNEL_MEMBER_UPDATED) return;
        const event = message as HubMemberEvent;
        if (event.hubId !== hubId) return;
        const now = getCurrentUnixTimestamp();
        setMembers(prev => prev.map(m => 
          m.id === event.userId 
            ? { ...m, role: event.role as HubMemberRole || m.role, updatedAt: now }
            : m
        ));
      }
    };

    const unsubscribes = Object.entries(handlers).map(([eventType, handler]) => 
      subscribe(eventType as WSEventType, handler)
    );

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [hubId, subscribe]);

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
 * Hook for managing hub
-specific UI operations - handles typing indicators,
 * online status, and other UI state
 */
export function useHubUI(hubId: number | null) {
  const { subscribe } = useWebSocket()
  const [typingUsers, setTypingUsers] = useState<number[]>([])
  
  useEffect(() => {
    if (!hubId) return
    
    const unsubscribeTyping = subscribe(WSEventType.TYPING, (event: WebSocketEvent) => {
      if (event.type !== WSEventType.TYPING) return
      const msg = (event as TypingEvent).payload
      if (msg.hubId === hubId) {
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
  }, [hubId, subscribe])

  return {
    typingUsers
  }
}