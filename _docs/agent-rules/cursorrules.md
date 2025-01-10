# Cursor Rules

## Documentation References
Follow patterns and guidelines from:
- docs/assistant-guidelines.md for project management and approvals
- docs/instructions.md for code style and implementation

## Response Format
1. When suggesting code changes:
   - Show only modified sections with context
   - Use file paths in code blocks
   - Add brief explanations for changes
   - Flag if changes need approval per assistant-guidelines.md

2. When reviewing code:
   - Check against instructions.md principles
   - Prioritize simplicity and readability
   - Flag potential technical debt
   - Suggest improvements proactively

3. When implementing features:
   - Follow Initial Assessment checklist from assistant-guidelines.md
   - Break into discrete tasks
   - Flag items needing approval
   - Use type hints and follow TypeScript best practices

## Code Style Enforcement
- Enforce simplicity over cleverness
- Remove unnecessary comments and docstrings
- Use descriptive naming
- Keep functions focused and small
- Add type hints wherever possible
- Group related code together
- Use 2-space indentation
- Handle errors explicitly

## Import Patterns
ALWAYS use TypeScript path aliases:
- ✅ import { User } from '@models/User'
- ✅ import { API_VERSION } from '@constants/api'
- ✅ import { WebSocketClient } from '@websocket/client'
- ✅ import type { AppConfig } from '@types'
- ❌ NEVER use relative imports (../../models/User)
- ❌ NEVER use direct package paths (packages/shared/src/models)

Available path aliases:
- @platica/shared/*: shared package source
- @server/*: server source
- @web/*: web app source
- @models/*: shared models
- @constants/*: shared constants
- @websocket/*: websocket utilities
- @types: shared types

## Project Structure
- Follow architecture.md patterns
- Group by feature rather than type
- Maintain flat structure where possible
- Keep related code together

## CRITICAL: Approval Requirements

STOP AND REQUEST EXPLICIT APPROVAL BEFORE PROCEEDING if ANY changes would:

1. Modify Data Models
   - New types or schemas
   - Database schema changes
   - New fields or relationships
   - Changes to existing models
   ⚠️ DO NOT WRITE ANY CODE until approval received

2. Introduce New Patterns
   - Architectural patterns not in architecture.md
   - New state management approaches
   - New ways of handling data flow
   ⚠️ DO NOT WRITE ANY CODE until approval received

3. Add/Modify Dependencies
   - New npm packages
   - Version updates
   - Changes to package.json
   ⚠️ DO NOT WRITE ANY CODE until approval received

4. Cross-Cutting Changes
   - Changes affecting multiple system components
   - Changes to shared utilities
   - Changes to core functionality
   ⚠️ DO NOT WRITE ANY CODE until approval received

IMPLEMENTATION RULES:
1. ALWAYS scan ALL proposed changes for these conditions BEFORE writing code
2. If ANY of these conditions are found, IMMEDIATELY STOP
3. Present the requirements for approval clearly to the user
4. Wait for EXPLICIT approval before proceeding
5. Never bundle these changes quietly within larger changes
6. Never assume approval based on context

Example Response When Approval Needed:
"⚠️ APPROVAL REQUIRED: This change would require:
1. New data model for user preferences
2. New dependency on @types/redis
3. Changes to shared authentication logic

Please review and explicitly approve these changes before I proceed with implementation."

## Tech Stack Preferences
- Bun for backend services and file management
- Node.js for features missing from Bun API
- TypeScript with strict mode enabled
- React with functional components
- Tailwind CSS for styling

## Error Handling
- Use TypeScript for type safety
- Provide clear error messages
- Handle edge cases explicitly
- Validate inputs thoroughly
- Use try/catch blocks appropriately

## Testing Requirements
- Write tests for new functionality
- Update existing tests when modifying code
- Follow existing test patterns
- Ensure proper error case coverage
- Use appropriate testing utilities
