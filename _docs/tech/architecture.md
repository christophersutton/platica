# Platica MVP Architecture

## Overview

Platica MVP is built on Bun for server-side operations including HTTP server, WebSocket handling, and database management. The system uses SQLite for data persistence with Litestream for replication, and S3-compatible storage for documents and media. The frontend is React-based using TailwindUI and shadcn components.

## Core Systems

### Storage Layer

SQLite Database (Main)
- User accounts and authentication
- Channel and room metadata
- Member relationships and permissions
- Message metadata and settings
- Session management

For detailed database documentation including schema, models, and patterns, see [database.md](./database.md).

Core Tables:
- User accounts and profiles
- Workspaces and channels
- Messages and reactions
- Files and attachments (used with S3 for document storage)

Key Database Patterns:
1. Repository Pattern for data access
2. Type-safe model mapping
3. Optimized query patterns
4. JSON storage for complex objects
5. Soft deletes using deleted_at timestamps

S3 Document Store
- Bulletin content (text/A/V)
- File attachments
- Future: Minutes and memos

### Service Layer

The service layer implements different patterns based on the service's responsibility:

1. HTTP Controller Pattern
```typescript
export class BaseController {
  protected async handle<T>(c: Context, fn: () => Promise<T>): Promise<Response> {
    try {
      const data = await fn();
      return this.success(c, data);
    } catch (err) {
      return this.error(c, err as Error);
    }
  }

  protected requireUser(c: Context): { userId: number; email: string } {
    const user = c.get('user');
    if (!user) throw new ApiError('Unauthorized', 401);
    return user;
  }

  protected async requireBody<T>(c: Context): Promise<T> {
    try {
      return await c.req.json() as T;
    } catch (err) {
      throw new ApiError('Invalid request body', 400);
    }
  }
}
```

2. Stateful Service Pattern (Singletons)
```typescript
export class WebSocketService {
  private static instance: WebSocketService;
  private clients: Map<ServerWebSocket, Client>;

  private constructor() {
    this.clients = new Map();
    this.initializeState();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
}
```

3. Utility Service Pattern
```typescript
export class EmailService {
  static async sendMagicLink(email: string, magicLink: string) {
    // Pure utility function
    // No state, no database access
  }
}
```

Core Services and Their Patterns:

1. Controllers (HTTP Endpoints):
   - AuthController: Authentication and session management
   - ChannelController: Channel and message operations
   - WorkspaceController: Workspace and member management
   - MessageController: Message operations and reactions

2. Stateful Services:
   - WebSocketService: Real-time communication and presence
   - DatabaseService: Database connection management
   - WriteService: Message write operations and broadcasting

3. Utility Services:
   - EmailService: Email notifications and templates
   - FileService: File metadata and S3 operations

Service Responsibilities:

1. Controllers:
   - Handle HTTP endpoints
   - Validate requests
   - Enforce permissions
   - Return standardized responses
   - Use repositories for data access

2. Stateful Services:
   - Manage shared runtime state
   - Handle real-time operations
   - Maintain connections and sessions
   - Broadcast events
   - Clean up resources

3. Utility Services:
   - Provide stateless operations
   - Handle external service integration
   - Process data transformations
   - No direct database access

Key Implementation Patterns:

1. Error Handling:
```typescript
export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: 200 | 201 | 400 | 401 | 403 | 404 | 500 = 400,
    public readonly meta?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

2. Response Format:
```typescript
interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
```

3. Repository Pattern:
```typescript
export abstract class BaseRepository<T extends BaseModel> {
  protected readonly db: Database;

  constructor(dbProvider: Database | DatabaseProvider) {
    this.db = 'db' in dbProvider ? dbProvider.db : dbProvider;
  }

  abstract getTableName(): string;

  async findById(id: number): Promise<T | undefined> {
    const result = this.db
      .prepare(`SELECT * FROM ${this.getTableName()} WHERE id = ?`)
      .get(id) as T | null;
    return result ? this.deserializeRow(result) : undefined;
  }
}
```

4. WebSocket Message Pattern:
```typescript
interface WebSocketMessage {
  type: WSEventType;
  channelId?: number;
  workspaceId?: number;
  userId?: number;
  data?: unknown;
}
```

### Web Application Patterns

The web application follows React best practices with a focus on type safety and component reusability:

1. Component Organization
```typescript
// Feature Components (pages/)
// Main views and route handlers
export const FeaturePage = () => {
  // Feature-specific logic and state
  return <Layout><FeatureContent /></Layout>;
};

// Shared Components (components/)
// Reusable UI elements with shadcn/ui
export const SharedComponent = ({ 
  children, 
  ...props 
}: Props) => {
  return <div {...props}>{children}</div>;
};
```

2. Custom Hooks Pattern
```typescript
// Domain-specific hooks (hooks/)
export function useDomainHook(config: Config) {
  // State and side effects
  useEffect(() => {
    // Setup and cleanup
  }, [dependencies]);

  return {
    // Actions and state
  };
}
```

3. State Management
- React Query for server state
- Context for global app state
- Local state for component-specific data

4. Routing and Protection
- React Router for navigation
- Protected routes with auth checks
- Workspace/channel-based routing

5. UI Components
- shadcn/ui base components
- TailwindCSS for styling
- Toast notifications
- Tooltips and modals

### Shared Package Patterns

The shared package (`@platica/shared`) defines common types, constants, and utilities used across the application:

1. Base Models
```typescript
// Base model for all database entities
interface BaseModel {
    id: number;
    created_at: UnixTimestamp;
    updated_at: UnixTimestamp;
}

// Extended base models for specific patterns
interface SoftDeletableModel extends BaseModel {
    deleted_at: UnixTimestamp | null;
}

interface VersionedModel extends BaseModel {
    version: number;
}
```

2. Type Organization
- `/models`: Domain entity types
- `/api`: Request/response types
- `/constants`: Enums and constants
- `/websocket`: WebSocket message types

3. Type Safety Patterns
- Strict TypeScript configuration
- Readonly types where appropriate
- Discriminated unions for messages
- Branded types for special values

4. API Contracts
- Request/response type pairs
- Validation schemas
- Error types and codes
- WebSocket message protocols

### Communication Layer

REST API Endpoints:
- Authentication
  - POST /auth/login
  - POST /auth/logout
  - POST /auth/refresh
  - GET /auth/session

- Workspaces
  - POST /workspaces
  - GET /workspaces
  - GET /workspaces/:id
  - PATCH /workspaces/:id
  - DELETE /workspaces/:id
  - POST /workspaces/:id/invites
  - GET /workspaces/:id/invites
  - POST /workspaces/:id/members
  - DELETE /workspaces/:id/members/:userId
  - PATCH /workspaces/:id/members/:userId/role

- Users
  - GET /users/me
  - PATCH /users/me
  - GET /users/:id
  - GET /users/presence

- Channels
  - POST /workspaces/:workspaceId/channels
  - GET /workspaces/:workspaceId/channels
  - GET /channels/:id
  - PATCH /channels/:id
  - DELETE /channels/:id
  - GET /channels/:id/members
  - POST /channels/:id/members
  - DELETE /channels/:id/members/:userId

- Messages
  - POST /channels/:channelId/messages
  - GET /channels/:channelId/messages
  - PATCH /messages/:id
  - DELETE /messages/:id
  - POST /messages/:id/reactions
  - DELETE /messages/:id/reactions/:type

- Files
  - POST /workspaces/:workspaceId/files
  - POST /files/attach
  - GET /files/:id/download
  - DELETE /files/:id

Controller Pattern:
```typescript
// Base controller with common functionality
export abstract class BaseController {
  protected handle(c: Context, fn: () => Promise<any>): Promise<Response> {
    try {
      const result = await fn();
      return c.json(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected requireUser(c: Context): User {
    const user = c.get('user');
    if (!user) throw new ApiError('Unauthorized', 401);
    return user;
  }

  protected requireBody<T>(c: Context): Promise<T> {
    return c.req.json<T>();
  }
}

// Domain-specific controller implementation
export class DomainController extends BaseController {
  constructor(private repos: Repositories) {
    super();
  }

  static create(dbProvider: DatabaseProvider): DomainController {
    return new DomainController(
      new DomainRepository(dbProvider.db)
    );
  }

  // Request handlers with consistent error handling
  handleRequest = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const user = this.requireUser(c);
      const data = await this.repos.domain.findById(id);
      return { data };
    });
  };
}

WebSocket Topics:
- org: Organization-wide events
- user:{userId}: User-specific notifications
- channel:{channelId}: Channel messages and events
- room:{roomId}: Room state and messages
- presence: User online status updates

WebSocket Events:
- channel.created
- channel.updated
- channel.deleted
- channel.message
- channel.typing
- room.created
- room.updated
- room.deleted
- room.joined
- room.left
- user.presence
- chat.message
- chat.typing

### Authentication & Authorization

#### Authentication Flow

1. **Magic Link Authentication**
```typescript
interface MagicLinkRequest {
  email: string;
  redirect_url?: string;
}

interface MagicLinkResponse {
  message: string;
  expires_in: number;
}
```

Flow:
1. User requests magic link (`POST /auth/login`)
2. System generates one-time token and sends email
3. User clicks link with token
4. System validates token and creates session
5. User receives session token in HTTP-only cookie

2. **Session Management**
```typescript
interface Session {
  user_id: number;
  email: string;
  created_at: UnixTimestamp;
  expires_at: UnixTimestamp;
}

interface SessionToken {
  token: string;
  user_id: number;
  expires_at: UnixTimestamp;
}
```

Session Lifecycle:
- Created on successful authentication
- Stored in `auth_tokens` table
- HTTP-only cookie with session token
- Auto-refresh when approaching expiration
- Invalidated on logout or security events

3. **Token Management**
```typescript
class AuthTokenRepository extends BaseRepository<AuthToken> {
  async createToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
    
    await this.db.prepare(`
      INSERT INTO auth_tokens (user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, token, expiresAt, Math.floor(Date.now() / 1000));
    
    return token;
  }

  async validateToken(token: string): Promise<Session | undefined> {
    const now = Math.floor(Date.now() / 1000);
    return this.db.prepare(`
      SELECT at.*, u.email
      FROM auth_tokens at
      JOIN users u ON u.id = at.user_id
      WHERE at.token = ?
      AND at.expires_at > ?
    `).get(token, now) as Session | undefined;
  }
}
```

#### Authorization Model

1. **Permission Levels**

Workspace Level:
- `owner`: Full workspace control
- `admin`: Manage users and settings
- `member`: Basic workspace access

Channel Level:
- `owner`: Full channel control
- `member`: Read/write messages

2. **Permission Checks**
```typescript
class PermissionService {
  static async canAccessWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const member = await db.prepare(`
      SELECT role FROM workspace_users
      WHERE workspace_id = ? AND user_id = ?
    `).get(workspaceId, userId);
    return !!member;
  }

  static async canManageWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const member = await db.prepare(`
      SELECT role FROM workspace_users
      WHERE workspace_id = ? AND user_id = ?
      AND role IN ('owner', 'admin')
    `).get(workspaceId, userId);
    return !!member;
  }

  static async canAccessChannel(
    userId: number,
    channelId: number
  ): Promise<boolean> {
    const member = await db.prepare(`
      SELECT cm.role
      FROM channel_members cm
      JOIN channels c ON c.id = cm.channel_id
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE cm.channel_id = ?
      AND cm.user_id = ?
    `).get(channelId, userId);
    return !!member;
  }
}
```

3. **Middleware Implementation**
```typescript
export async function requireAuth(
  c: Context,
  next: Next
): Promise<Response | undefined> {
  const session = await validateSession(c);
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  c.set('user', {
    userId: session.user_id,
    email: session.email
  });
  
  return next();
}

export function requireWorkspaceRole(roles: string[]) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const { userId } = c.get('user');
    const workspaceId = c.req.param('workspaceId');
    
    const member = await db.prepare(`
      SELECT role FROM workspace_users
      WHERE workspace_id = ? AND user_id = ?
    `).get(workspaceId, userId);
    
    if (!member || !roles.includes(member.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    return next();
  };
}
```

4. **Route Protection**
```typescript
// Workspace routes with role-based protection
app.post('/workspaces/:id/invites', 
  requireAuth,
  requireWorkspaceRole(['owner', 'admin']),
  handleInvite
);

// Channel routes with access checks
app.get('/channels/:id/messages',
  requireAuth,
  requireChannelAccess,
  handleGetMessages
);
```

#### Security Best Practices

1. **Session Security**
- HTTP-only cookies for session tokens
- Secure flag in production
- CSRF protection
- Regular session cleanup

2. **Access Control**
- Consistent permission checks
- Role-based access control
- Resource-level permissions
- Audit logging for sensitive actions

3. **Rate Limiting**
- Login attempt limits
- API rate limiting
- Workspace-level quotas
- Channel message rate limits

4. **Security Headers**
- CORS configuration
- Content Security Policy
- XSS protection
- Frame options

### Error Handling

1. API Error Structure
```typescript
interface ApiError {
  code: string;           // Machine-readable error code
  message: string;        // User-friendly message
  details?: unknown;      // Additional context
  requestId?: string;     // For tracking/debugging
}
```

2. Error Categories
- Authentication (AUTH_*)
- Authorization (PERM_*)
- Validation (VAL_*)
- Resource (RES_*)
- Rate Limiting (RATE_*)
- System (SYS_*)

3. Error Recovery
- Automatic retry for transient failures
- Circuit breakers for external services
- Graceful degradation strategies
- Clear user feedback paths

## Future Considerations

Areas for Extension:
1. Secretary Integration
   - Event processing system
   - AI service integration
   - Natural language processing
   - Document generation

2. Rich Media
   - WebRTC integration
   - Media processing
   - Stream management
   - Avatar generation
