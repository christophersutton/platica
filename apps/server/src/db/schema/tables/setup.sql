BEGIN TRANSACTION;

-- =====================================
-- USERS
-- =====================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'administrator', 'moderator', 'member', 'secretary'

  -- Presence
  presence_is_online BOOLEAN NOT NULL DEFAULT 0,
  presence_door_status TEXT NOT NULL DEFAULT 'closed',
  presence_location_type TEXT NOT NULL DEFAULT 'none',
  presence_location_id TEXT DEFAULT NULL,
  presence_last_active TEXT NOT NULL,

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
  assigned_secretary_id TEXT NOT NULL,  -- references a user with role=secretary

  FOREIGN KEY (assigned_secretary_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================
-- SECRETARIES
-- =====================================
CREATE TABLE IF NOT EXISTS secretaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,  -- references users(id), role='secretary'
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- HUBS
-- =====================================
CREATE TABLE IF NOT EXISTS hubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expiration_policy TEXT NOT NULL, -- e.g. '1d', '2d', '1w', '2w'
  secretary_enabled BOOLEAN NOT NULL DEFAULT 1,
  is_invite_only BOOLEAN NOT NULL DEFAULT 0,

  -- The permanent assigned secretary for this hub
  assigned_secretary_id TEXT NOT NULL, -- references users(id) with role=secretary

  FOREIGN KEY (assigned_secretary_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================
-- HUB MODERATORS (Pivot)
-- =====================================
CREATE TABLE IF NOT EXISTS hub_moderators (
  hub_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (hub_id, user_id),
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- ROOMS
-- =====================================
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  hub_id TEXT,
  topic TEXT,
  created_by TEXT NOT NULL,      -- userId
  start_time TEXT,
  end_time TEXT,
  is_active BOOLEAN NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Potential assigned secretary if needed
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
-- MESSAGES (Hub or Room)
-- =====================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  hub_id TEXT,
  room_id TEXT,
  sender_id TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- ATTACHMENTS
-- =====================================
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================
-- MESSAGE -> ATTACHMENTS (Pivot)
-- =====================================
CREATE TABLE IF NOT EXISTS message_attachments (
  message_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  PRIMARY KEY (message_id, attachment_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);

-- =====================================
-- BULLETINS
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

-- =====================================
-- BULLETIN -> ATTACHMENTS (Pivot)
-- =====================================
CREATE TABLE IF NOT EXISTS bulletin_attachments (
  bulletin_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  PRIMARY KEY (bulletin_id, attachment_id),
  FOREIGN KEY (bulletin_id) REFERENCES bulletins(id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);

-- =====================================
-- MEMOS
-- =====================================
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

-- =====================================
-- MEMO TAGS (Pivot)
-- =====================================
CREATE TABLE IF NOT EXISTS memo_tags (
  memo_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (memo_id, tag),
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
);

-- =====================================
-- MINUTES
-- =====================================
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

-- =====================================
-- EVENTS
-- =====================================
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT,
  timestamp TEXT NOT NULL,
  triggered_by TEXT,
  FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMIT;