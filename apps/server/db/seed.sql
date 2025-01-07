-- Create a test workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES (1, 'Test Workspace', unixepoch(), unixepoch());

-- Add test user to workspace as admin
INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
SELECT 1, id, 'admin', unixepoch(), unixepoch()
FROM users
WHERE email = 'test@example.com';

-- Create a test channel
INSERT INTO channels (id, workspace_id, name, description, is_private, created_by, created_at, updated_at)
SELECT 1, 1, 'general', 'General discussion', 0, id, unixepoch(), unixepoch()
FROM users
WHERE email = 'test@example.com';

-- Add test user to channel
INSERT INTO channel_members (channel_id, user_id, created_at)
SELECT 1, id, unixepoch()
FROM users
WHERE email = 'test@example.com'; 