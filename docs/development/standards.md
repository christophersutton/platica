# Development Standards

## Core Principles

### Code Style
- Embrace simplicity over cleverness
- Write code for humans first, computers second
- Keep functions focused and small
- Use descriptive naming
- Handle errors explicitly

### TypeScript Configuration
- Strict mode enabled
- Explicit return types
- Proper null handling
- No implicit any

### Import Patterns

Always use TypeScript path aliases:
```typescript
// ✅ Correct
import { User } from '@models/User'
import { API_VERSION } from '@constants/api'
import { WebSocketClient } from '@websocket/client'
import type { AppConfig } from '@types'

// ❌ Incorrect
import { User } from '../../models/User'
import { API_VERSION } from 'packages/shared/src/constants'
```

Available Path Aliases:
- @platica/shared/*: Shared package source
- @server/*: Server source
- @web/*: Web app source
- @models/*: Shared models
- @constants/*: Shared constants
- @websocket/*: WebSocket utilities
- @types: Shared types

### Project Structure
- Group by feature rather than type
- Maintain flat structure where possible
- Keep related code together
- Use consistent file organization

### Function Design
- Single responsibility per function
- Limit to 20 lines where possible
- 3 or fewer parameters
- Clear return types
- Proper error handling

### State Management
- Use React Query for server state
- Context for global app state
- Local state for component-specific data
- Clear state ownership boundaries

### Error Handling
- Use TypeScript for type safety
- Provide clear error messages
- Handle edge cases explicitly
- Validate inputs thoroughly
- Use try/catch blocks appropriately

### Testing Requirements
- Write tests for new functionality
- Update existing tests when modifying
- Follow existing test patterns
- Ensure error case coverage
- Use appropriate testing utilities

## Object-Oriented Patterns

### Single Responsibility
```typescript
// ✅ Good
class UserRepository {
  async save(user: User): Promise<void> {
    // Database operations only
  }
}

class EmailService {
  async sendWelcome(user: User): Promise<void> {
    // Email operations only
  }
}

// ❌ Bad
class UserManager {
  async saveUser(user: User): Promise<void> {
    // Mixed database and email operations
  }
}
```

### Dependency Injection
```typescript
// ✅ Good
class OrderService {
  constructor(
    private readonly emailService: EmailService,
    private readonly paymentService: PaymentService
  ) {}
}

// ❌ Bad
class OrderService {
  private emailService = new EmailService()
  private paymentService = new PaymentService()
}
```

### Clear Interfaces
```typescript
interface MessageRepository {
  findById(id: number): Promise<Message | undefined>
  save(message: Message): Promise<void>
  delete(id: number): Promise<void>
}

class SQLiteMessageRepository implements MessageRepository {
  // Implementation
}
```

## Best Practices

### Component Design
- Use functional components
- Keep components focused
- Proper prop typing
- Clear documentation
- Reusable patterns

### Performance
- Proper memoization
- Lazy loading
- Code splitting
- Resource optimization

### Accessibility
- Proper ARIA attributes
- Keyboard navigation
- Screen reader support
- Color contrast

### Security
- Input validation
- Output encoding
- CSRF protection
- Authentication checks
- Authorization validation