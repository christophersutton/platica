import { DatabaseService } from './core/database';
import { getCurrentUnixTimestamp } from '../utils/time';

const dbService = DatabaseService.getWriteInstance();

// Seed data
const testUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  created_at: getCurrentUnixTimestamp(),
  updated_at: getCurrentUnixTimestamp()
};

const testWorkspace = {
  id: 1,
  name: 'Test Workspace',
  slug: 'test-workspace',
  owner_id: testUser.id,
  settings: '{}',
  created_at: getCurrentUnixTimestamp(),
  updated_at: getCurrentUnixTimestamp()
};

const workspaceUser = {
  workspace_id: testWorkspace.id,
  user_id: testUser.id,
  role: 'owner',
  settings: '{}',
  created_at: getCurrentUnixTimestamp(),
  updated_at: getCurrentUnixTimestamp()
};

// Insert seed data
dbService.transaction(() => {
  // Insert test user
  dbService.db.prepare(`
    INSERT INTO users (id, email, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    testUser.id,
    testUser.email,
    testUser.name,
    testUser.created_at,
    testUser.updated_at
  );

  // Insert test workspace
  dbService.db.prepare(`
    INSERT INTO workspaces (id, name, slug, owner_id, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    testWorkspace.id,
    testWorkspace.name,
    testWorkspace.slug,
    testWorkspace.owner_id,
    testWorkspace.settings,
    testWorkspace.created_at,
    testWorkspace.updated_at
  );

  // Insert workspace user relationship
  dbService.db.prepare(`
    INSERT INTO workspace_users (workspace_id, user_id, role, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    workspaceUser.workspace_id,
    workspaceUser.user_id,
    workspaceUser.role,
    workspaceUser.settings,
    workspaceUser.created_at,
    workspaceUser.updated_at
  );
});

console.log('✅ Database seeded successfully'); 