# Database Schema Reference

## Core Entities

### Users
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```
Purpose: Stores user account information and profile data.

### Workspaces
```sql
CREATE TABLE workspaces (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL,
    icon_url TEXT,
    file_size_limit INTEGER,
    default_message_retention_days INTEGER,
    notification_defaults TEXT,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users (id)
);
```
Purpose: Represents organizational spaces where teams collaborate.

## Membership & Access

### Workspace Users
```sql
CREATE TABLE workspace_users (
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'owner', 'admin', 'member', 'guest'
    display_name TEXT,
    status TEXT,
    status_message TEXT,
    notification_preferences TEXT,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);
```
Purpose: Manages workspace membership and user roles.

### Auth Tokens
```sql
CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```
Purpose: Handles authentication and session management.

## Communication Spaces

### Hubs
```sql
CREATE TABLE hubs (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    topic TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```
Purpose: Public, persistent communication streams.

### Rooms
```sql
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scheduled_start INTEGER NOT NULL,
    scheduled_end INTEGER NOT NULL,
    started_at INTEGER,
    ended_at INTEGER,
    status TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);
```
Purpose: Time-boxed collaboration spaces.

## Messages & Content

### Messages
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    hub_id INTEGER,           -- NULL for DMs
    sender_id INTEGER NOT NULL,
    thread_id INTEGER,            -- NULL for top-level messages
    content TEXT NOT NULL,
    type TEXT,                    -- Message type enum
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at INTEGER,
    deleted_at INTEGER,           -- Soft delete
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```
Purpose: All forms of text communication.

### Direct Messages
```sql
CREATE TABLE direct_messages (
    workspace_id INTEGER NOT NULL,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, user1_id, user2_id)
);
```
Purpose: Tracks private conversations between users.

### Files
```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    uploader_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    deleted_at INTEGER,           -- Soft delete
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```
Purpose: Manages uploaded files and attachments.

## Engagement & Interaction

### Reactions
```sql
CREATE TABLE reactions (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
);
```
Purpose: Message reactions and emoji responses.

### Mentions
```sql
CREATE TABLE mentions (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id)
);
```
Purpose: Tracks user mentions in messages.

## Performance Indexes

### Message Indexes
```sql
CREATE INDEX idx_messages_hub_created ON messages(hub_id, created_at);
CREATE INDEX idx_messages_workspace_created ON messages(workspace_id, created_at);
CREATE INDEX idx_messages_thread_created ON messages(thread_id, created_at);
CREATE INDEX idx_messages_type ON messages(type);
```

### Membership Indexes
```sql
CREATE INDEX idx_hub_members_user ON hub_members(user_id);
CREATE INDEX idx_workspace_users_user ON workspace_users(user_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);
CREATE INDEX idx_room_members_active ON room_members(room_id, left_at);
```

### Content Indexes
```sql
CREATE INDEX idx_files_workspace ON files(workspace_id);
CREATE INDEX idx_files_message ON files(message_id);
CREATE INDEX idx_mentions_user ON mentions(user_id);
```

### Room Indexes
```sql
CREATE INDEX idx_rooms_workspace ON rooms(workspace_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_scheduled ON rooms(scheduled_start);
```

## JSON Fields

Several tables use JSON fields stored as TEXT:
- workspaces.notification_defaults
- workspaces.settings
- workspace_users.notification_preferences
- workspace_users.settings
- hubs.settings
- hub_members.settings
- rooms.settings
- room_members.state

These fields allow for flexible configuration without schema changes.