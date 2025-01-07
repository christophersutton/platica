-- Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS mentions;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS direct_messages;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS channel_members;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS workspace_users;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS workspace_invites;
DROP TABLE IF EXISTS channel_invites;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS workspaces;

-- Core Tables

-- Users table (no dependencies)
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Auth tokens table (depends on users)
CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Workspaces table (no dependencies)
CREATE TABLE workspaces (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL,
    icon_url TEXT,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

-- Workspace invites table
CREATE TABLE workspace_invites (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    inviter_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL, -- 'owner', 'admin', 'member', 'guest'
    status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (inviter_id) REFERENCES users (id)
);

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

-- Workspace users table
CREATE TABLE workspace_users (
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'owner', 'admin', 'member', 'guest'
    settings TEXT NOT NULL DEFAULT '{}',
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
    topic TEXT,
    is_private BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- Channel members table
CREATE TABLE channel_members (
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    is_muted BOOLEAN NOT NULL DEFAULT false,
    last_read_at INTEGER,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
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
    attachments TEXT,             -- JSON array of attachment objects
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at INTEGER,
    deleted_at INTEGER,           -- Soft delete
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
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

-- Performance indexes
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX idx_messages_workspace_created ON messages(workspace_id, created_at);
CREATE INDEX idx_messages_thread_created ON messages(thread_id, created_at);
CREATE INDEX idx_channel_members_user ON channel_members(user_id);
CREATE INDEX idx_files_workspace ON files(workspace_id);
CREATE INDEX idx_mentions_user ON mentions(user_id);