import { Database } from "bun:sqlite";
import { join } from "path";

const db = new Database(join(import.meta.dir, "../data/db.sqlite"));

async function seed() {
  // Transaction to ensure data consistency
  db.transaction(() => {
    // Create a demo workspace
    db.run(`
      INSERT INTO workspaces (name, created_at, updated_at)
      VALUES ('Demo Workspace', unixepoch(), unixepoch())
    `);
    const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    const workspaceId = result.id;

    // Create some demo users
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

    // Add users to workspace
    users.forEach(userId => {
      db.run(`
        INSERT INTO workspace_users (workspace_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, 'member', unixepoch(), unixepoch())
      `, [workspaceId, userId]);
    });

    // Create a demo channel
    db.run(`
      INSERT INTO channels (workspace_id, name, description, created_by, created_at, updated_at)
      VALUES (?, 'general', 'General discussion', ?, unixepoch(), unixepoch())
    `, [workspaceId, users[0]]);
  })();

  console.log("✅ Seed data inserted successfully!");
}

seed().catch(console.error); 