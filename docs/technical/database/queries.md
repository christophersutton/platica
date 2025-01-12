# Database Query Patterns

## Core Patterns

### Repository Pattern
```typescript
abstract class BaseRepository<T extends BaseModel> {
    protected db: Database;
    
    constructor(db: Database) {
        this.db = db;
    }
    
    abstract getTableName(): string;
    
    async findById(id: number): Promise<T | undefined> {
        return this.db
            .prepare(`SELECT * FROM ${this.getTableName()} WHERE id = ?`)
            .get(id) as T | undefined;
    }
}
```

### Message Queries

#### Get Hub Messages
```typescript
function getHubMessages({
    hubId,
    limit = 50,
    before,
    after
}: {
    hubId: number;
    limit?: number;
    before?: number;
    after?: number;
}): Promise<Message[]> {
    const conditions = ['hub_id = ?'];
    const params = [hubId];
    
    if (before) {
        conditions.push('id < ?');
        params.push(before);
    }
    if (after) {
        conditions.push('id > ?');
        params.push(after);
    }
    
    params.push(limit);
    
    return db.prepare(`
        SELECT * FROM messages
        WHERE ${conditions.join(' AND ')}
        ORDER BY id DESC
        LIMIT ?
    `).all(...params) as Message[];
}
```

#### Get Thread Messages
```typescript
function getThreadMessages(threadId: number): Promise<Message[]> {
    return db.prepare(`
        SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ?
        ORDER BY m.created_at ASC
    `).all(threadId) as Message[];
}
```

### Workspace Queries

#### Get User Workspaces
```typescript
function getUserWorkspaces(userId: number): Promise<Workspace[]> {
    return db.prepare(`
        SELECT w.*, wu.role
        FROM workspaces w
        JOIN workspace_users wu ON wu.workspace_id = w.id
        WHERE wu.user_id = ?
        ORDER BY w.created_at DESC
    `).all(userId) as Workspace[];
}
```

#### Get Workspace Members
```typescript
function getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
    return db.prepare(`
        SELECT wu.*, u.name, u.email, u.avatar_url
        FROM workspace_users wu
        JOIN users u ON u.id = wu.user_id
        WHERE wu.workspace_id = ?
        ORDER BY wu.role DESC, u.name ASC
    `).all(workspaceId) as WorkspaceMember[];
}
```

### Room Queries

#### Get Active Rooms
```typescript
function getActiveRooms(workspaceId: number): Promise<Room[]> {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`
        SELECT r.*, COUNT(rm.id) as participant_count
        FROM rooms r
        LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.left_at IS NULL
        WHERE r.workspace_id = ?
        AND r.status = 'active'
        AND r.scheduled_end > ?
        GROUP BY r.id
        ORDER BY r.scheduled_start ASC
    `).all(workspaceId, now) as Room[];
}
```

## Query Optimization

### Using Indexes
```typescript
// Good: Uses hub_id + created_at index
const messages = await db.prepare(`
    SELECT * FROM messages
    WHERE hub_id = ?
    ORDER BY created_at DESC
    LIMIT 50
`).all(hubId);

// Bad: Doesn't use available indexes
const messages = await db.prepare(`
    SELECT * FROM messages
    WHERE hub_id = ?
    ORDER BY (created_at + updated_at) DESC
    LIMIT 50
`).all(hubId);
```

### Batch Operations
```typescript
function createReactions(reactions: Reaction[]): Promise<void> {
    return db.transaction(() => {
        const stmt = db.prepare(`
            INSERT INTO reactions (message_id, user_id, emoji, created_at)
            VALUES (?, ?, ?, ?)
        `);
        
        for (const reaction of reactions) {
            stmt.run(
                reaction.message_id,
                reaction.user_id,
                reaction.emoji,
                Math.floor(Date.now() / 1000)
            );
        }
    })();
}
```

### JSON Operations
```typescript
// Update specific settings field
function updateHubSettings(
    hubId: number,
    key: string,
    value: unknown
): Promise<void> {
    return db.prepare(`
        UPDATE hubs
        SET settings = json_set(
            settings,
            '$.' || ?,
            json(?),
            '$.' || ? || ' IS NULL'
        )
        WHERE id = ?
    `).run(key, JSON.stringify(value), key, hubId);
}
```

## Performance Considerations

### 1. Use Proper Indexes
- Create indexes for common query patterns
- Monitor index usage
- Avoid over-indexing

### 2. Batch Operations
- Use transactions for multiple operations
- Prepare statements for repeated queries
- Balance batch size

### 3. JSON Storage
- Use for flexible data
- Index important JSON fields
- Keep JSON structures flat

### 4. Connection Management
- Reuse prepared statements
- Proper connection pooling
- Transaction scope management