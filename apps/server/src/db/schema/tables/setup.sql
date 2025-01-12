BEGIN TRANSACTION;

-- Drop tables to start fresh (if desired)
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
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS bulletins;
DROP TABLE IF EXISTS bulletin_attachments;
DROP TABLE IF EXISTS memos;
DROP TABLE IF EXISTS memo_tags;
DROP TABLE IF EXISTS artifacts_minutes;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS secretaries;
DROP TABLE IF EXISTS hubs;
DROP TABLE IF EXISTS hub_moderators;
DROP TABLE IF EXISTS hub_members;

-- =====================================
-- USERS
-- =====================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'administrator', 'moderator', 'member', 'secretary'
  avatar_url TEXT DEFAULT NULL,

  -- Presence
  presence_is_online BOOLEAN NOT NULL DEFAULT 0,
  presence_door_status TEXT NOT NULL DEFAULT 'closed',
  presence_location_type TEXT NOT NULL DEFAULT 'none',
  presence_location_id TEXT DEFAULT NULL,
  presence_last_active TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Notification Preferences
  notification_preferences_email BOOLEAN NOT NULL DEFAULT 1,
  notification_preferences_push BOOLEAN NOT NULL DEFAULT 1,
  notification_preferences_sms BOOLEAN NOT NULL DEFAULT 0,

  -- Lifecycle + Auth
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deactivated_at TEXT DEFAULT NULL,
  sso_provider TEXT,
  sso_id TEXT,

  -- Assigned Secretary
  assigned_secretary_id INTEGER,  -- references a user with role=secretary
  FOREIGN KEY (assigned_secretary_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================
-- SECRETARIES
-- =====================================
CREATE TABLE IF NOT EXISTS secretaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,  -- references users(id), role='secretary'
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Auth tokens table (depends on users)
CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id)
);

-- =====================================
-- WORKSPACES
-- =====================================
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

-- =====================================
-- WORKSPACE INVITES
-- =====================================
CREATE TABLE IF NOT EXISTS workspace_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

-- =====================================
-- WORKSPACE USERS
-- =====================================
CREATE TABLE IF NOT EXISTS workspace_users (
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  display_name TEXT,
  status TEXT,
  status_message TEXT,
  notification_preferences TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- =====================================
-- HUBS
-- =====================================
CREATE TABLE IF NOT EXISTS hubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expiration_policy TEXT NOT NULL DEFAULT 'never', -- example default
  secretary_enabled BOOLEAN NOT NULL DEFAULT 1,
  
  assigned_secretary_id INTEGER, -- optional

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_secretary_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================
-- HUB MODERATORS (Pivot)
-- =====================================
CREATE TABLE IF NOT EXISTS hub_moderators (
  hub_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (hub_id, user_id),
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- HUB MEMBERS (Pivot)
-- (Added to match seed script usage)
-- =====================================
CREATE TABLE IF NOT EXISTS hub_members (
  hub_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  unread_mentions INTEGER NOT NULL DEFAULT 0,
  last_read_at INTEGER DEFAULT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (hub_id, user_id),
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- ROOMS
-- (Kept, though not used in the current seed)
-- =====================================
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  hub_id TEXT,
  topic TEXT,
  created_by TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_active BOOLEAN NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  secretary_id TEXT,
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (secretary_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================
-- ROOM PARTICIPANTS (Pivot)
-- =====================================
CREATE TABLE IF NOT EXISTS room_participants (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY(room_id, user_id),
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- MESSAGES
-- Now includes 'type' and 'thread_id'
-- =====================================
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER,
  hub_id INTEGER,
  room_id TEXT, -- Not used by seed, but we keep it for future
  sender_id INTEGER NOT NULL,
  thread_id INTEGER, -- for threaded replies
  content TEXT,
  type TEXT DEFAULT 'text',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- =====================================
-- FILES
-- Created to match the seed script
-- =====================================
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER,
  uploader_id INTEGER,
  message_id INTEGER,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- =====================================
-- REACTIONS
-- Added to match the seed script
-- =====================================
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- BULLETINS, MEMOS, ETC.
-- Kept from original, though not used by seeds
-- =====================================
CREATE TABLE IF NOT EXISTS bulletins (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  mediaUrl TEXT,
  posted_by TEXT NOT NULL,
  hub_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bulletin_attachments (
  bulletin_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  PRIMARY KEY (bulletin_id, attachment_id),
  FOREIGN KEY (bulletin_id) REFERENCES bulletins(id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,   -- can be a secretary or regular user
  signed_by TEXT NOT NULL,   -- must be a non-secretary user (app logic)
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (signed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memo_tags (
  memo_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (memo_id, tag),
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS minutes (
  id TEXT PRIMARY KEY,
  hub_id TEXT,
  room_id TEXT,
  generated_by TEXT NOT NULL,  -- must be user w/ role=secretary
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT,
  timestamp TEXT NOT NULL,
  triggered_by TEXT,
  FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMIT;