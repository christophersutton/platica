import { Database } from "bun:sqlite";
import { join } from "path";

const db = new Database(join(import.meta.dir, "../data/db.sqlite"));
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

async function seed() {
  // Transaction to ensure data consistency
  db.transaction(() => {
    // Create test user first (if doesn't exist)
    db.run(`
      INSERT OR IGNORE INTO users (email, name, created_at, updated_at)
      VALUES (?, ?, unixepoch(), unixepoch())
    `, [TEST_EMAIL, TEST_EMAIL.split("@")[0]]);

    const testUser = db.query("SELECT id FROM users WHERE email = ?").get(TEST_EMAIL) as { id: number };

    // Create a demo workspace
    db.run(`
      INSERT INTO workspaces (name, created_at, updated_at)
      VALUES ('Demo Workspace', unixepoch(), unixepoch())
    `);

    const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    const workspaceId = result.id;

    // Add test user as admin
    db.run(`
      INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, 'admin', unixepoch(), unixepoch())
    `, [workspaceId, testUser.id]);

    // Create some additional demo users
    const users = [
      ['john@demo.com', 'John Demo'],
      ['jane@demo.com', 'Jane Demo'],
    ].map(([email, name]) => {
      db.run(`
        INSERT INTO users (email, name, created_at, updated_at)
        VALUES (?, ?, unixepoch(), unixepoch())
      `, [email, name]);
      const userResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
      return userResult.id;
    });

    // Add demo users to workspace as members
    users.forEach(userId => {
      db.run(`
        INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, 'member', unixepoch(), unixepoch())
      `, [workspaceId, userId]);
    });

    // Create a general channel
    db.run(`
      INSERT INTO channels (workspace_id, name, description, created_by, created_at, updated_at)
      VALUES (?, 'general', 'General discussion', ?, unixepoch(), unixepoch())
    `, [workspaceId, testUser.id]);

    const channelId = db.query("SELECT last_insert_rowid() as id").get() as { id: number };

    // Add all users to the general channel
    db.run(`
      INSERT INTO channel_members (channel_id, user_id, created_at)
      VALUES (?, ?, unixepoch())
    `, [channelId.id, testUser.id]);

    users.forEach(userId => {
      db.run(`
        INSERT INTO channel_members (channel_id, user_id, created_at)
        VALUES (?, ?, unixepoch())
      `, [channelId.id, userId]);
    });
  })();

  console.log("✅ Seed data inserted successfully!");
}

seed().catch(console.error); 