# Frontend Architecture

## State Management

### Domain Organization

The frontend state is organized around core domains (Hubs, Rooms, Chats) with a clear separation between global and domain-specific state management.

```
Global State        | Hub State     | Room State        | Chat State
-------------------------------------------------------------------------------
User Auth          | Hub Messages  | Room Messages     | Chat Messages
Base Presence      | Hub Members   | Room Members      | Chat Partners
Workspace Data     | Hub Typing    | Room Typing       | Chat Typing
                   | Hub Presence  | Room Presence     | Chat Presence
```

### Presence System

Presence is managed at multiple levels:

1. **Global Presence** (PresenceContext)
   - Basic online/offline status
   - Last seen timestamp
   - Custom status messages
   - Current room status (affects chat availability)
   - Connection state

2. **Domain-Specific Presence**
   - Hub: viewing/active in hub

   - Room: participating/speaking/roles
   - Chat: active in conversation

### State Management Hierarchy

```tsx
<AuthProvider>        {/* Authentication state */}
  <PresenceProvider>  {/* Global presence */}
    <WebSocketProvider>
      <WorkspaceProvider>
        <HubProvider>  {/* Hub-specific state */}
          <RoomProvider>   {/* Room-specific state */}
            <ChatProvider> {/* Chat-specific state */}
              <App />
            </ChatProvider>
          </RoomProvider>
        </HubProvider>
      </WorkspaceProvider>
    </WebSocketProvider>
  </PresenceProvider>
</AuthProvider>
```

## Domain-Specific Patterns

### Hub Context
```typescript
interface HubState {
  hubs: NormalizedHubs
  activeHub: number | null
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

### Room Context
```typescript
interface RoomState {
  rooms: NormalizedRooms
  activeRoom: number | null
  typing: Record<number, {
    userIds: number[]
    lastUpdate: number
  }>
  presence: Record<number, {
    participants: number[]
    speaking?: number[]
  }>
}
```

### Chat Context
```typescript
interface ChatState {
  activeChats: NormalizedChats
  typing: Record<number, {
    isTyping: boolean
    lastUpdate: number
  }>
  presence: Record<number, {
    isActive: boolean
    lastSeen: number
  }>
}
```

## WebSocket Integration

Each domain context subscribes to relevant WebSocket events:

```typescript
// Example: Hub Context
useWebSocketSubscription(WSEventType.CHANNEL_MESSAGE, handleMessage)
useWebSocketSubscription(WSEventType.CHANNEL_TYPING, handleTyping)
useWebSocketSubscription(WSEventType.CHANNEL_PRESENCE, handlePresence)
```

## State Normalization

All domain objects are normalized using a consistent pattern:

```typescript
interface NormalizedState<T> {
  byId: Record<number, T>
  allIds: number[]
  loading: Record<number, boolean>
  errors: Record<number, Error | null>
}
```

## Performance Considerations

1. Each domain manages its own real-time state (typing/presence)
2. Updates are scoped to specific domains
3. Normalized state prevents duplicate data
4. Proper cleanup on unmount
5. Debounced typing indicators
6. Batched presence updates

## Error Handling

1. Each context maintains its own error state
2. Global error boundary for fatal errors
3. Domain-specific error recovery
4. Proper WebSocket reconnection logic
5. Optimistic updates with rollback 