# Data Flow Architecture

## Message Flow

### Hub Message Flow
```
User Types Message → Client Validation → WebSocket Send →
Server Validation → Database Write → WebSocket Broadcast →
Client Updates → Persistence Layer → Secretary Processing
```

### Room Message Flow
```
User Sends Message → Client Processing → WebSocket Send →
Room State Update → Participant Broadcast → Ephemeral Storage →
Optional Persistence → Minutes Generation
```

### Chat Message Flow
```
User Sends Message → Client Validation → WebSocket Send →
Recipient Status Check → Message Delivery → Ephemeral Storage →
Auto-Archive Check
```

## State Management

### Global State
- User authentication
- Workspace context
- Base presence
- System settings

### Domain State
- Hub/Room/Chat specific data
- Participant information
- Message history
- Local UI state

### Persistence Rules
- Hubs: Persistent by default
- Rooms: Time-boxed persistence
- Chats: Ephemeral with auto-archive
- Documents: Permanent storage

## Real-time Updates

### WebSocket Events
- Message events
- Presence updates
- Typing indicators
- Room state changes
- System notifications

### State Synchronization
- Optimistic updates
- Conflict resolution
- State recovery
- Connection management

## Data Processing

### Message Processing
1. Content parsing
2. Mention extraction
3. Link processing
4. File handling
5. AI processing

### Knowledge Management
1. Message categorization
2. Summary generation
3. Action item extraction
4. Knowledge base updates
5. Search indexing

## For Implementation Details

- [WebSocket Protocol](../technical/api/websocket.md)
- [State Management](../technical/frontend/state.md)
- [Database Operations](../technical/database/operations.md)