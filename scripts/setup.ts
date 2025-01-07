import { $ } from "bun";

async function main() {
  try {
    // Initialize database
    console.log("🏗️ Creating database...");
    await $`bun run --cwd apps/server db:init`;

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