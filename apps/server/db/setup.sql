-- Database Schema

-- Search Architecture
--
-- The system uses a separate read replica database for search functionality. 
-- This replica is kept up-to-date via Litestream replication from the main database.
-- FTS triggers are only implemented on the search replica, preventing any impact
-- on write performance in the main database while maintaining robust search capabilities.

-- Core Tables

-- Channel invites table
CREATE TABLE channel_invites (
    id INTEGER PRIMARY KEY,
    channel_id INTEGER NOT NULL,
    inviter_id INTEGER NOT NULL,
    invitee_id INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES channels (id),
    FOREIGN KEY (inviter_id) REFERENCES users (id),
    FOREIGN KEY (invitee_id) REFERENCES users (id)
);

-- Workspace invites table
CREATE TABLE workspace_invites (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    inviter_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (inviter_id) REFERENCES users (id)
);

-- Workspaces table
CREATE TABLE workspaces (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    file_size_limit INTEGER,
    default_message_retention_days INTEGER,
    notification_defaults TEXT
);

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Workspace users table
CREATE TABLE workspace_users (
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'admin' or 'member'
    display_name TEXT,
    status TEXT,        -- online status
    status_message TEXT,
    notification_preferences TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Channels table
CREATE TABLE channels (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- Channel members table
CREATE TABLE channel_members (
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_muted BOOLEAN NOT NULL DEFAULT false,
    last_read_at INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Messages table
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    channel_id INTEGER,           -- NULL for DMs
    sender_id INTEGER NOT NULL,
    thread_id INTEGER,            -- NULL for top-level messages
    content TEXT NOT NULL,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at INTEGER,
    deleted_at INTEGER,           -- Soft delete
    created_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (channel_id) REFERENCES channels (id),
    FOREIGN KEY (sender_id) REFERENCES users (id),
    FOREIGN KEY (thread_id) REFERENCES messages (id)
);

-- Direct messages table
CREATE TABLE direct_messages (
    workspace_id INTEGER NOT NULL,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, user1_id, user2_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (user1_id) REFERENCES users (id),
    FOREIGN KEY (user2_id) REFERENCES users (id)
);

-- Reactions table
CREATE TABLE reactions (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji),
    FOREIGN KEY (message_id) REFERENCES messages (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Files table
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    uploader_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (uploader_id) REFERENCES users (id),
    FOREIGN KEY (message_id) REFERENCES messages (id)
);

-- Mentions table
CREATE TABLE mentions (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Search Database Tables and Triggers
-- The following tables and triggers exist only in the search replica database:

-- FTS Tables
CREATE VIRTUAL TABLE messages_fts USING fts5(content, content='messages', content_rowid='id');
CREATE VIRTUAL TABLE files_fts USING fts5(name, content='files', content_rowid='id');

-- Message FTS sync triggers
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

-- File FTS sync triggers
CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, name) VALUES (new.id, new.name);
END;

CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name) VALUES('delete', old.id, old.name);
END;

CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name) VALUES('delete', old.id, old.name);
  INSERT INTO files_fts(rowid, name) VALUES (new.id, new.name);
END;

-- Performance indexes
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX idx_messages_workspace_created ON messages(workspace_id, created_at);
CREATE INDEX idx_messages_thread_created ON messages(thread_id, created_at);
CREATE INDEX idx_channel_members_user ON channel_members(user_id);
CREATE INDEX idx_files_workspace ON files(workspace_id);
CREATE INDEX idx_mentions_user ON mentions(user_id);

-- Search indexes (using SQLite FTS5)
-- Note: These require triggers to keep in sync with source tables
CREATE VIRTUAL TABLE messages_fts USING fts5(content, content='messages', content_rowid='id');
CREATE VIRTUAL TABLE files_fts USING fts5(name, content='files', content_rowid='id');