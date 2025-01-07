import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import type { WebSocketMessage } from './use-websocket';
import { useWorkspace } from './use-workspace';
import { useAuth } from './use-auth';

interface UserPresence {
  [userId: number]: {
    status: 'online' | 'offline';
    lastUpdate: number;
  };
}

export function usePresence() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState<UserPresence>({});
  const lastUpdateRef = useRef<{ [userId: number]: number }>({});

  const handlePresenceChange = useCallback((userId: number, status: 'online' | 'offline') => {
    const now = Date.now();
    
    // Prevent duplicate/rapid updates for the same status
    if (lastUpdateRef.current[userId]) {
      const timeSinceLastUpdate = now - lastUpdateRef.current[userId];
      if (timeSinceLastUpdate < 1000 && presenceMap[userId]?.status === status) {
        console.log('[Presence] Skipping rapid update:', { userId, status, timeSinceLastUpdate });
        return;
      }
    }
    
    console.log('[Presence] Status update:', { userId, status });
    lastUpdateRef.current[userId] = now;
    
    setPresenceMap(prev => ({
      ...prev,
      [userId]: {
        status,
        lastUpdate: now
      }
    }));
  }, [presenceMap]);

  const handlePresenceSync = useCallback((onlineUsers: number[]) => {
    console.log('[Presence] Initial sync:', { onlineUsers });
    const now = Date.now();
    
    setPresenceMap(prev => {
      const newMap = { ...prev }; // Preserve existing presence info
      
      // Only update users in the current workspace
      if (workspace?.id) {
        // Mark all users in this workspace as offline first
        Object.keys(prev).forEach(userIdStr => {
          const userId = Number(userIdStr);
          // Only update if we know this user is in the current workspace
          if (prev[userId]?.lastUpdate > now - 60000) { // Only if updated in last minute
            newMap[userId] = {
              status: 'offline',
              lastUpdate: now
            };
          }
        });
        
        // Then mark online users as online
        onlineUsers.forEach(userId => {
          newMap[userId] = {
            status: 'online',
            lastUpdate: now
          };
        });
      }
      
      return newMap;
    });
  }, [workspace?.id]);

  const { isConnected } = useWebSocket({
    workspaceId: workspace?.id ?? 0,
    onPresenceChange: handlePresenceChange,
    onMessage: useCallback((message: WebSocketMessage) => {
      if (message.type === 'presence_sync' && Array.isArray(message.onlineUsers)) {
        handlePresenceSync(message.onlineUsers);
      }
    }, [handlePresenceSync])
  });

  // Update our own status based on connection state
  useEffect(() => {
    if (user?.id && isConnected) {
      handlePresenceChange(user.id, 'online');
    }
  }, [isConnected, user?.id, handlePresenceChange]);

  return {
    presenceMap,
    isUserOnline: useCallback(
      (userId: number) => presenceMap[userId]?.status === 'online',
      [presenceMap]
    )
  };
} 