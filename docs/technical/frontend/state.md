# State Management

## Overview

Platica uses a hybrid state management approach:
- React Query for server state
- Context for global application state
- Local state for component-specific needs
- WebSocket for real-time updates

## Domain-Specific State

### Channel State
```typescript
interface ChannelState {
  channels: NormalizedChannels
  activeChannel: number | null
  typing: Record<number, {
    userIds: number[]
    lastUpdate: number
  }>
  presence: Record<number, {
    activeUsers: number[]
    viewingUsers: number[]
  }>
}
```

### Room State
```typescript
interface RoomState {
  rooms: NormalizedRooms
  activeRoom: number | null
  participants: Record<number, {
    speaking: boolean
    video: boolean
    sharing: boolean
  }>
  settings: RoomSettings
}
```

### Chat State
```typescript
interface ChatState {
  activeChats: NormalizedChats
  typing: Record<number, boolean>
  unread: Record<number, number>
  drafts: Record<number, string>
}
```

## State Normalization Pattern

```typescript
interface NormalizedState<T> {
  byId: Record<number, T>
  allIds: number[]
  loading: Record<number, boolean>
  errors: Record<number, Error | null>
}
```

## Real-time State Updates

### WebSocket Integration
```typescript
function useWebSocketUpdates(type: WSEventType, handler: WSEventHandler) {
  useEffect(() => {
    const ws = getWebSocket();
    ws.subscribe(type, handler);
    return () => ws.unsubscribe(type, handler);
  }, [type, handler]);
}
```

### Optimistic Updates
```typescript
function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sendMessage,
    onMutate: async (newMessage) => {
      // Optimistically update UI
      await queryClient.cancelQueries(['messages', channelId]);
      const previousMessages = queryClient.getQueryData(['messages', channelId]);
      queryClient.setQueryData(['messages', channelId], old => ({
        ...old,
        messages: [...old.messages, newMessage]
      }));
      return { previousMessages };
    },
    onError: (err, newMessage, context) => {
      // Roll back on error
      queryClient.setQueryData(
        ['messages', channelId], 
        context.previousMessages
      );
    }
  });
}
```

## State Management Best Practices

### 1. Clear Boundaries
- Separate server and client state
- Use appropriate state solutions for different needs
- Maintain clear state ownership

### 2. Performance Optimization
- Normalize nested data
- Use selective updates
- Implement proper cleanup
- Cache management

### 3. Type Safety
- Define clear interfaces
- Use discriminated unions
- Maintain strict null checks
- Proper error typing

### 4. Testing Considerations
- Isolate state logic
- Mock external dependencies
- Test state transitions
- Verify optimistic updates