import { $ } from "bun";
import { Database } from "bun:sqlite";
import { join } from "path";

async function main() {
  try {
    const serverDir = join(import.meta.dir, "../apps/server");
    
    // Initialize database
    console.log("🏗️ Creating database...");
    const db = new Database(join(serverDir, "data/db.sqlite"));
    
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
        'users',
        'direct_messages'
      ];
      
      tables.forEach(table => {
        db.run(`DROP TABLE IF EXISTS ${table}`);
      });
    })();
    
    // Initialize schema
    console.log("📝 Creating tables...");
    await $`cat ${join(serverDir, "src/db/schema/tables/setup.sql")} | sqlite3 ${join(serverDir, "data/db.sqlite")}`;

    // Seed database if requested
    if (process.argv.includes("--with-seed")) {
      console.log("🌱 Seeding database...");
      await $`bun run --cwd ${serverDir} db:seed`;
    }

    console.log("✅ Database setup complete!");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

main();