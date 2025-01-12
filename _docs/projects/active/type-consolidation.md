# Type System Consolidation

## Request
Review, analyze and consolidate type definitions across the codebase. Current issues:
- Types scattered across different locations
- Potential duplicate definitions
- Need to align with new architecture direction

## Status
- [ ] In Assessment
- [x] In Development
- [ ] Ready for Review
- [ ] Complete
- [ ] Archived

## Initial Assessment Findings

### Type Distribution
- Total Definitions: 168
- By Kind:
  - Interfaces: 82
  - Types: 47
  - Const Types: 33
  - Enums: 6
- By Location:
  - apps/: 130 definitions
  - packages/: 38 definitions

### Key Issues

1. Duplicate Core Types:
   - Core domain types (User, Workspace, Hub, Message) duplicated between shared/types.ts and web/lib/api.ts
   - WebSocket types duplicated between shared/websocket.ts and web/contexts/AppContext.tsx
   - API response types duplicated across three locations

2. Pattern Issues:
   - Inconsistent type locations for similar concerns
   - WebSocket types split between packages
   - Constants sometimes used where types would be more appropriate
   - Multiple definitions of auth-related types

3. Location Issues:
   - Too many types in apps/ vs packages/
   - Types that should be shared are duplicated in apps
   - Test-specific types mixed with main types

## Progress Update

### Completed Tasks
- Set up proper directory structure in shared package
- Created path aliases in tsconfig files for cleaner imports
- Consolidated core domain types into separate files
- Consolidated WebSocket types
- Created proper type hierarchy (Base -> API -> UI types)
- Removed old types.ts file (backed up as types.ts.bak)

### Decisions Made
- Decision 1: Type Organization Strategy
  - Core types live in models/ directory
  - Separate files for user.ts, workspace.ts, hub
.ts, message.ts
  - Three-layer type hierarchy: Base types -> API types -> UI types
  - WebSocket types consolidated in websocket.ts
  - Base types in types.ts
  - Constants and enums in constants/

- Decision 2: Import Strategy
  - Using path aliases for cleaner imports
  - @models/, @constants/, @websocket/, @types
  - Consistent usage across all packages

## Tasks

### Task 1: Core Type Consolidation
#### Implementation Checklist
- [x] Consolidate core domain types
  - [x] User and Workspace types
  - [x] Hub and Message types
  - [x] API response types
- [ ] Update all imports to use shared types
  - [ ] Update web/lib/api.ts
  - [ ] Update server controllers
  - [ ] Update React components
  - [ ] Update WebSocket handlers
- [ ] Remove duplicate definitions
- [ ] Update tests to use shared types

### Task 2: WebSocket Type Consolidation
#### Implementation Checklist
- [x] Move all WebSocket types to shared package
- [x] Standardize WebSocket message types
- [x] Create proper type hierarchy for messages
- [ ] Update all WebSocket code to use shared types

### Task 3: Auth Type Consolidation
#### Implementation Checklist
- [x] Consolidate auth state types
- [x] Consolidate auth token types
- [x] Create proper auth type hierarchy
- [ ] Update auth-related code to use shared types

### Task 4: Import Updates (New)
#### Implementation Checklist
- [x] Web App Updates
  - [x] Update api.ts with shared types
  - [x] Update WebSocket-related files
  - [x] Update components using these types
  - [x] Update contexts and hooks
  
- [x] Server Updates
  - [x] Update controllers with shared types
  - [x] Update repositories to align with types
  - [x] Update WebSocket handlers
  - [x] Update middleware

### Task 6: Documentation & Cleanup (New)
#### Implementation Checklist
- [ ] Document type hierarchy
- [ ] Document import patterns
- [ ] Create type organization guide
- [ ] Final duplicate check
- [ ] Remove backup files

## Dependencies
- Need to coordinate with architecture cleanup
- Need to align with new product direction
- Need to consider impact on existing features