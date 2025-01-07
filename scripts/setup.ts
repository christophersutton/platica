import { $ } from "bun";
import { Database } from "bun:sqlite";
import { join } from "path";

async function main() {
  try {
    // Initialize database
    console.log("🏗️ Creating database...");
    const db = new Database(join(import.meta.dir, "../apps/server/data/db.sqlite"));
    
    // Drop existing tables if they exist
    console.log("🗑️  Cleaning up existing tables...");
    db.transaction(() => {
      const tables = [
        'channel_invites',
        'workspace_invites',
        'reactions',
        'mentions',
        'files',
        'messages',
        'channel_members',
        'channels',
        'workspace_users',
        'workspaces',
        'users'
      ];
      
      tables.forEach(table => {
        db.run(`DROP TABLE IF EXISTS ${table}`);
      });
    })();
    
    // Initialize schema
    console.log("📝 Creating tables...");
    await $`cat apps/server/db/setup.sql | sqlite3 apps/server/data/db.sqlite`;

    // Seed database if requested
    if (process.argv.includes("--with-seed")) {
      console.log("🌱 Seeding database...");
      await $`bun run --cwd apps/server db:seed`;
    }

    console.log("✅ Database setup complete!");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

main();