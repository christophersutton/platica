# Timestamp Standardization Project

## Request
Fix timestamp handling issues causing "RangeError: Invalid time value" errors in WebSocket message loading. Need to standardize timestamp handling across the full stack from database to frontend display.

## Status
- [x] In Assessment
- [ ] In Development
- [ ] Ready for Review
- [ ] Complete
- [ ] Archived

## Initial Assessment Checklist
- [x] Review relevant documentation
- [x] Identify affected system components:
  - Database storage (SQLite)
  - Server-side message handling (MessageRepository)
  - WebSocket message serialization
  - Frontend message processing
  - Frontend display components
- [x] Check if data model changes needed
- [x] Look for existing patterns in architecture.md
- [x] Break into discrete tasks
- [x] Flag any architecture questions
- [x] Request approval if needed

## Current State Assessment

### Database Layer
- Timestamps stored as Unix timestamps in seconds
- Conversion to milliseconds happens in MessageRepository.deserializeRow()
- Affects: created_at, updated_at, deleted_at fields

### Server Layer
- MessageRepository converts seconds to milliseconds during deserialization
- No validation of timestamp values before conversion
- No standardized error handling for invalid timestamps

### WebSocket Layer
- Messages validated by validateMessage() but no specific timestamp validation
- Potential serialization issues during JSON.stringify/parse
- ChatEvent interface includes full Message type with timestamps

### Frontend Layer
- Error occurs during Date.toISOString() call
- Likely receiving invalid timestamp values from WebSocket
- No validation or error handling for timestamp parsing

## Tasks

### Task 1: Add Timestamp Validation & Normalization
#### Implementation Checklist
- [ ] Create shared timestamp validation utility
- [ ] Add timestamp format constants (TIMESTAMP_FORMAT = 'milliseconds')
- [ ] Add validation to MessageRepository.deserializeRow
- [ ] Add validation to WebSocket message parsing
- [ ] Add validation to frontend timestamp handling
- [ ] Add error recovery for invalid timestamps

### Task 2: Standardize Timestamp Handling
#### Implementation Checklist
- [ ] Define standard timestamp format in @types
- [ ] Update Message interfaces to use strict timestamp typing
- [ ] Add conversion utilities for different timestamp formats
- [ ] Document timestamp handling requirements
- [ ] Add runtime type checking for timestamps

### Task 3: Database & Server Implementation
#### Implementation Checklist
- [ ] Update MessageRepository timestamp conversion
- [ ] Add timestamp validation before conversion
- [ ] Add error handling for invalid timestamps
- [ ] Update tests to cover timestamp edge cases
- [ ] Add logging for timestamp conversion issues

### Task 4: Frontend Implementation
#### Implementation Checklist
- [ ] Add timestamp validation on WebSocket message receipt
- [ ] Update message context timestamp handling
- [ ] Add error boundaries for timestamp display
- [ ] Add fallback display for invalid timestamps
- [ ] Update tests for timestamp handling

### Task 5: Testing & Verification
#### Implementation Checklist
- [ ] Test timestamp handling across full message lifecycle
- [ ] Verify historical message loading
- [ ] Test invalid timestamp handling
- [ ] Test timezone edge cases
- [ ] Load test with large message sets

## Questions/Notes
- Should we store timestamps in milliseconds in the database to avoid conversion?
- Do we need to handle messages with future timestamps?
- Should we enforce any timestamp bounds?
- Do we need to handle migration of existing messages?
- Should we add a timestamp validation step in the WebSocket message validation?

## Decisions Needed
- Standard timestamp format across all layers (milliseconds vs seconds)
- Timezone handling strategy (UTC everywhere except display?)
- Validation rules for acceptable timestamp ranges
- Error handling strategy for invalid timestamps
- Migration strategy for existing data 