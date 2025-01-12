# Frontend Architecture

## Application Structure

### Directory Organization
```
src/
├── components/      # Reusable UI components
├── features/        # Feature-specific code
├── hooks/          # Custom React hooks
├── lib/            # Utilities and services
├── pages/          # Route components
├── providers/      # Context providers
├── styles/         # Global styles
└── types/          # TypeScript definitions
```

## State Management Hierarchy

```
App
├── AuthProvider            # Authentication state
├── WebSocketProvider      # Real-time communication
├── WorkspaceProvider     # Current workspace context
│   ├── HubProvider  # Hub state
│   ├── RoomProvider    # Room state
│   └── ChatProvider   # Chat state
└── UIProvider        # Global UI state
```

## Core Features Implementation

### Real-time Communication
- WebSocket connection management
- Event handling and dispatch
- Presence tracking
- Message synchronization

### State Management
- React Query for server state
- Context for global state
- Local state for UI
- Real-time state sync

### UI Components
- shadcn/ui base components
- TailwindCSS styling
- Custom component library
- Responsive design

## For Implementation Details
- [Component Library](./components.md)
- [State Management](./state.md)
- [Real-time Features](./realtime.md)
- [UI Patterns](./ui-patterns.md)