# Ephemeral Chat Implementation

## Request
Implement ephemeral 1-to-1 chat functionality with consideration for room presence. Users are only available for chat when online and not in a room. Repurpose existing DM section in left sidebar for chat initiation, preparing for eventual three-column layout (chats | channels | rooms).

## Status
- [x] In Assessment
- [ ] In Development
- [ ] Ready for Review
- [ ] Complete
- [ ] Archived

## Initial Assessment Checklist
- [x] Review relevant documentation
- [x] Identify affected system components
- [x] Check if data model changes needed
- [x] Look for existing patterns in architecture.md
- [x] Break into discrete tasks if needed
- [x] Flag any architecture questions
- [x] Request approval if needed

## Tasks

### Task 1: Enhanced Presence System
#### Implementation Checklist
- [ ] Define new user states (offline, available, in_room)
- [ ] Update presence WebSocket events
- [ ] Add room status tracking to presence system
- [ ] Add presence change broadcasts
- [ ] Update existing presence hooks and contexts
- [ ] Add proper cleanup on disconnect

#### Pre-Submission Checklist
- [ ] All changes follow architecture.md
- [ ] No new types/schemas created
- [ ] Only shared package types used
- [ ] Changes are minimal and focused
- [ ] Documentation updated if needed
- [ ] Tests added/updated

### Task 2: Left Sidebar Chat UI
#### Implementation Checklist
- [ ] Modify existing DM section to handle chat availability
- [ ] Update user list to filter based on availability state
- [ ] Add visual indicators for user state (online/in_room)
- [ ] Implement chat initiation flow
- [ ] Add proper sorting (available users first)
- [ ] Handle status updates in real-time

#### Pre-Submission Checklist
- [ ] All changes follow architecture.md
- [ ] No new types/schemas created
- [ ] Only shared package types used
- [ ] Changes are minimal and focused
- [ ] Documentation updated if needed
- [ ] Tests added/updated

### Task 3: Chat Window Implementation
#### Implementation Checklist
- [ ] Create ChatWindow component
- [ ] Implement message display area
- [ ] Add message input with typing indicator
- [ ] Handle user state changes during chat
- [ ] Implement chat termination on room join
- [ ] Add error states for status changes
- [ ] Ensure no minimize functionality

#### Pre-Submission Checklist
- [ ] All changes follow architecture.md
- [ ] No new types/schemas created
- [ ] Only shared package types used
- [ ] Changes are minimal and focused
- [ ] Documentation updated if needed
- [ ] Tests added/updated

### Task 4: WebSocket Message Handler
#### Implementation Checklist
- [ ] Add chat-specific message types
- [ ] Implement in-memory message store
- [ ] Add presence-triggered cleanup
- [ ] Handle room join message cleanup
- [ ] Implement proper connection recovery
- [ ] Add typing indicator events

#### Pre-Submission Checklist
- [ ] All changes follow architecture.md
- [ ] No new types/schemas created
- [ ] Only shared package types used
- [ ] Changes are minimal and focused
- [ ] Documentation updated if needed
- [ ] Tests added/updated

## Questions/Notes
- Should chat windows auto-close when a user joins a room? Not Yet but possibly
- How should we handle in-progress chats if user joins room? Leaves the chat, no more messages can be sent
- Do we need transition animations between columns? will cover this when we build the rooms out, but yes. 
- Should we add any visual/audio notification when someone becomes available? not yet
- How do we handle chat requests if user joins room before accepting? chats should open immediately upon receipt. make it "costly" to send someone a chat! 

## Decisions
- User States: [2025-01-10] Users can only be in one state: offline, available, or in_room
- Layout Strategy: [2025-01-10] Will prepare three-column layout but only activate rooms column when implementing rooms
- Chat Termination: [2025-01-10] Active chats will close if either participant joins a room
- Presence Updates: [2025-01-10] Room status will be part of presence system rather than separate system