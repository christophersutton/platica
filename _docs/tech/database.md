# Database Architecture

## Overview

Platica uses SQLite for data persistence with Litestream for replication. This document outlines our database architecture, models, and patterns.

## Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX users_email ON users(email);
```

#### workspaces
```sql
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id INTEGER NOT NULL,
  file_size_limit INTEGER NOT NULL DEFAULT 10485760, -- 10MB
  default_message_retention_days INTEGER NOT NULL DEFAULT 90,
  notification_defaults TEXT NOT NULL, -- JSON object
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX workspaces_slug ON workspaces(slug);
CREATE INDEX workspaces_owner ON workspaces(owner_id);
```

#### workspace_users
```sql
CREATE TABLE workspace_users (
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  status_message TEXT,
  notification_preferences TEXT NOT NULL, -- JSON object
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX workspace_users_user ON workspace_users(user_id);
```

#### channels
```sql
CREATE TABLE channels (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(workspace_id, name)
);

CREATE INDEX channels_workspace ON channels(workspace_id);
```

#### channel_members
```sql
CREATE TABLE channel_members (
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'member')),
  unread_mentions INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX channel_members_user ON channel_members(user_id);
```

#### messages
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  thread_id INTEGER,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('text', 'file', 'system')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (thread_id) REFERENCES messages(id)
);

CREATE INDEX messages_channel ON messages(channel_id);
CREATE INDEX messages_sender ON messages(sender_id);
CREATE INDEX messages_thread ON messages(thread_id);
CREATE INDEX messages_type ON messages(type);
```

#### reactions
```sql
CREATE TABLE reactions (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX reactions_user ON reactions(user_id);
```

#### files
```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  uploader_id INTEGER NOT NULL,
  message_id INTEGER,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX files_workspace ON files(workspace_id);
CREATE INDEX files_uploader ON files(uploader_id);
CREATE INDEX files_message ON files(message_id);
```

### Authentication Tables

#### auth_tokens
```sql
CREATE TABLE auth_tokens (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX auth_tokens_user ON auth_tokens(user_id);
CREATE INDEX auth_tokens_token ON auth_tokens(token);
CREATE INDEX auth_tokens_expires ON auth_tokens(expires_at);
```

## Model-Schema Mapping

Our TypeScript models (in `@platica/shared/models`) map directly to database tables:

```typescript
// Base model interface
interface BaseModel {
  id: number;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

// User model maps to users table
interface User extends BaseModel {
  email: string;
  name: string;
  avatar_url?: string;
}

// Workspace model maps to workspaces table
interface Workspace extends BaseModel {
  name: string;
  slug: string;
  owner_id: number;
  file_size_limit: number;
  default_message_retention_days: number;
  notification_defaults: NotificationDefaults;
}

// WorkspaceUser model maps to workspace_users table
interface WorkspaceUser {
  workspace_id: number;
  user_id: number;
  role: 'admin' | 'member';
  display_name?: string;
  status: UserStatus;
  status_message?: string;
  notification_preferences: NotificationPreferences;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

// Channel model maps to channels table
interface Channel extends BaseModel {
  workspace_id: number;
  name: string;
  description?: string;
  created_by: number;
}

// Message model maps to messages table
interface Message extends BaseModel {
  workspace_id: number;
  channel_id: number;
  sender_id: number;
  thread_id?: number;
  content: string;
  type: MessageType;
}

// File model maps to files table
interface File extends BaseModel {
  workspace_id: number;
  uploader_id: number;
  message_id?: number;
  name: string;
  size: number;
  mime_type: string;
  s3_key: string;
  deleted_at?: UnixTimestamp;
}
```

## Repository Pattern

We use the repository pattern to encapsulate database access. Each model has a corresponding repository class that inherits from `BaseRepository`:

```typescript
abstract class BaseRepository<T extends BaseModel> {
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

  protected deserializeRow(row: Record<string, unknown>): T {
    // Handle JSON deserialization and type conversion
    return row as T;
  }

  protected serializeRow(model: Partial<T>): Record<string, unknown> {
    // Handle JSON serialization and type conversion
    return model as Record<string, unknown>;
  }
}
```

### Query Patterns

1. **Basic CRUD Operations**
```typescript
class UserRepository extends BaseRepository<User> {
  getTableName() { return 'users'; }

  async create(data: CreateUserData): Promise<User> {
    const now = Math.floor(Date.now() / 1000);
    const result = this.db.prepare(`
      INSERT INTO users (email, name, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.email,
      data.name,
      data.avatar_url,
      now,
      now
    );
    return this.findById(result.lastInsertRowid as number);
  }

  async update(id: number, data: UpdateUserData): Promise<User> {
    const now = Math.floor(Date.now() / 1000);
    const sets: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      sets.push('name = ?');
      values.push(data.name);
    }
    if (data.avatar_url !== undefined) {
      sets.push('avatar_url = ?');
      values.push(data.avatar_url);
    }

    sets.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`
      UPDATE users
      SET ${sets.join(', ')}
      WHERE id = ?
    `).run(...values);

    return this.findById(id);
  }
}
```

2. **Relationship Queries**
```typescript
class ChannelRepository extends BaseRepository<Channel> {
  async getMembers(channelId: number): Promise<ChannelMember[]> {
    return this.db.prepare(`
      SELECT cm.*, u.name, u.avatar_url
      FROM channel_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.channel_id = ?
      ORDER BY cm.created_at ASC
    `).all(channelId) as ChannelMember[];
  }

  async getMessages(
    channelId: number,
    options: {
      limit?: number;
      before?: number;
      after?: number;
    } = {}
  ): Promise<Message[]> {
    const conditions: string[] = ['channel_id = ?'];
    const values: unknown[] = [channelId];

    if (options.before) {
      conditions.push('id < ?');
      values.push(options.before);
    }
    if (options.after) {
      conditions.push('id > ?');
      values.push(options.after);
    }

    const limit = options.limit || 50;
    values.push(limit);

    return this.db.prepare(`
      SELECT *
      FROM messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY id DESC
      LIMIT ?
    `).all(...values) as Message[];
  }
}
```

3. **Batch Operations**
```typescript
class MessageRepository extends BaseRepository<Message> {
  async createMany(messages: CreateMessageData[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    
    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          workspace_id, channel_id, sender_id,
          thread_id, content, type,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {
        stmt.run(
          msg.workspace_id,
          msg.channel_id,
          msg.sender_id,
          msg.thread_id,
          msg.content,
          msg.type,
          now,
          now
        );
      }
    })();
  }
}
```

## Query Optimization

1. **Use Indexes Effectively**
- Primary key lookups
- Foreign key joins
- Common filter conditions
- Sorting operations

2. **Batch Operations**
- Use transactions for multiple inserts/updates
- Bulk fetch related records
- Cache frequently accessed data

3. **Pagination**
- Use cursor-based pagination for large datasets
- Limit result sets
- Use covering indexes when possible

4. **JSON Storage**
- Store complex objects as JSON
- Use JSON functions for querying when needed
- Consider denormalization for performance

## Migration Procedures

1. **Schema Changes**
- Use explicit transactions
- Add new columns as nullable or with defaults
- Drop columns/tables in separate migration
- Update related code before deploying

2. **Data Migration**
- Write idempotent migration scripts
- Test with production-size datasets
- Include rollback procedures
- Monitor performance impact

3. **Deployment**
- Deploy schema changes before code changes
- Use feature flags for gradual rollout
- Have rollback plan ready
- Monitor database performance

## Best Practices

1. **Type Safety**
- Use TypeScript types for all database operations
- Validate input data before queries
- Handle null/undefined values explicitly
- Use enums for constrained values

2. **Error Handling**
- Use specific error types
- Handle constraint violations
- Log database errors
- Implement retry logic where appropriate

3. **Performance**
- Monitor query performance
- Use appropriate indexes
- Optimize large queries
- Cache frequently accessed data

4. **Security**
- Use prepared statements
- Validate input data
- Implement proper access control
- Audit sensitive operations 