# Architecture Documentation Cleanup

## Request
Clean up and clarify architecture documentation, specifically:
1. Investigate server services usage
2. Update architecture.md to be comprehensive and clear
3. Ensure all patterns are documented

## Status
- [ ] In Assessment
- [x] In Development
- [ ] Ready for Review
- [ ] Complete
- [ ] Archived

## Initial Assessment Checklist
- [x] Review relevant documentation
- [x] Identify affected system components
- [ ] Check if data model changes needed (N/A for docs)
- [x] Look for existing patterns in architecture.md
- [x] Break into discrete tasks
- [ ] Flag any architecture questions
- [ ] Request approval if needed

## Tasks

### Task 1: Server Services Analysis
#### Implementation Checklist
- [x] List all current services in server
- [x] Determine which services are actively used
- [x] Identify any service pattern inconsistencies
- [x] Document service layer conclusions
- [x] Propose service layer recommendations

### Task 2: Architecture Pattern Documentation
#### Implementation Checklist
- [x] Document current server patterns (controllers, routes, repositories)
- [x] Document current web app patterns
- [x] Document shared package patterns
- [x] Identify any missing pattern documentation
- [x] Update architecture.md with findings

### Task 3: Pattern Alignment Review
#### Implementation Checklist
- [x] Compare documented patterns with actual codebase
- [x] Identify any deviations
- [x] Document reasons for deviations
- [x] Create cleanup recommendations if needed

#### Findings
1. Controller Pattern Implementation:
   - Actual implementation uses a more robust BaseController with standardized error handling
   - Controllers consistently use repositories for data access
   - Added documentation for error handling and response format patterns

2. Service Pattern Alignment:
   - Removed ManagementService (functionality moved to controllers)
   - WriteService added for message operations
   - FileService planned but not yet implemented
   - Documented actual service responsibilities and boundaries

3. Repository Pattern:
   - Added documentation for BaseRepository implementation
   - Clarified database provider pattern
   - Added type safety patterns

4. WebSocket Patterns:
   - Added documentation for message types and client management
   - Documented presence and typing indicator patterns
   - Clarified broadcast patterns

#### Recommendations
1. Complete FileService implementation following utility service pattern
2. Remove deprecated ReadService and ManagementService references
3. Consider consolidating WebSocket message type definitions
4. Add documentation for rate limiting patterns
5. Add documentation for middleware patterns

### Task 4: Core Documentation Updates
#### Implementation Checklist
- [x] Add basic database schema documentation
  - Tables and relationships
  - Key indexes
  - Access patterns
- [x] Add authentication/authorization section
  - Auth flow
  - Permission model
  - Session management
- [x] Clean up README structure
  - Remove planned docs that aren't needed yet
  - Add basic setup steps

## Questions/Notes
- Do we need to document test patterns more explicitly?
- Should we consolidate ReadService functionality into repositories?

## Decisions
- Decision 1: [Complete] Services are a core part of the architecture, with three distinct patterns:
  1. HTTP Services for API endpoints
  2. Utility Services for stateless operations
  3. Stateful Services (singletons) for managing runtime state
- Decision 2: [Complete] Service cleanup needed:
  - Keep and document: DatabaseService, WebSocketService, WriteService, EmailService
  - Remove: ManagementService (functionality duplicated in ChannelController), ReadService, CacheService
  - Plan to implement: FileService (see implement-file-service.md)
- Decision 3: [Complete] Controller vs Service separation:
  - Controllers handle HTTP endpoints and business logic
  - Services provide utility functions or manage state
  - No mixing of patterns (e.g. no HTTP routes in services)
- Decision 4: [Complete] Documentation approach for MVP:
  - Keep all technical documentation in architecture.md
  - Focus on current patterns and implementations
  - Move future considerations to TODO.md
- Decision 5: [Complete] Documentation organization:
  - Single architecture.md for all technical documentation
  - Basic README with setup instructions
  - New TODO.md for tracking future work