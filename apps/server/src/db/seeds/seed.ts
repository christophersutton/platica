import { Database } from "bun:sqlite";
import { join } from "path";

const db = new Database(join(import.meta.dir, "../../../data/db.sqlite"));
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

async function seed() {
  console.log("🌱 Starting database seed...");
  
  try {
    // Transaction to ensure data consistency
    db.transaction(() => {
      console.log("Creating test user:", TEST_EMAIL);
      // Create test user first (if doesn't exist)
      db.run(`
        INSERT OR IGNORE INTO users (email, name, created_at, updated_at)
        VALUES (?, ?, unixepoch(), unixepoch())
      `, [TEST_EMAIL, TEST_EMAIL.split("@")[0]]);

      const testUser = db.query("SELECT id FROM users WHERE email = ?").get(TEST_EMAIL) as { id: number };
      console.log("Test user created with ID:", testUser.id);

      // Create a demo workspace
      console.log("Creating demo workspace...");
      db.run(`
        INSERT INTO workspaces (name, slug, owner_id, created_at, updated_at)
        VALUES ('Demo Workspace', 'demo-workspace', ?, unixepoch(), unixepoch())
      `, [testUser.id]);

      const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
      const workspaceId = result.id;
      console.log("Demo workspace created with ID:", workspaceId);

      // Add test user as admin
      console.log("Adding test user as workspace admin...");
      db.run(`
        INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, 'admin', unixepoch(), unixepoch())
      `, [workspaceId, testUser.id]);

      // Create some additional demo users
      console.log("Creating demo users...");
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
      console.log("Adding demo users to workspace...");
      users.forEach(userId => {
        db.run(`
          INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
          VALUES (?, ?, 'member', unixepoch(), unixepoch())
        `, [workspaceId, userId]);
      });

      // Create a general channel
      console.log("Creating general channel...");
      db.run(`
        INSERT INTO channels (workspace_id, name, description, created_by, created_at, updated_at)
        VALUES (?, 'general', 'General discussion', ?, unixepoch(), unixepoch())
      `, [workspaceId, testUser.id]);

      const channelId = db.query("SELECT last_insert_rowid() as id").get() as { id: number };

      // Add all users to the general channel
      console.log("Adding users to general channel...");
      db.run(`
        INSERT INTO channel_members (channel_id, user_id, created_at, updated_at)
        VALUES (?, ?, unixepoch(), unixepoch())
      `, [channelId.id, testUser.id]);

      users.forEach(userId => {
        db.run(`
          INSERT INTO channel_members (channel_id, user_id, created_at, updated_at)
          VALUES (?, ?, unixepoch(), unixepoch())
        `, [channelId.id, userId]);
      });
    })();

    // Verify the data was inserted
    const workspaceCount = db.query("SELECT COUNT(*) as count FROM workspaces").get() as { count: number };
    console.log(`✅ Seed complete! Created ${workspaceCount.count} workspace(s)`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed(); 