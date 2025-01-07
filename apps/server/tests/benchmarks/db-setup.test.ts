import { describe, expect, test } from "bun:test";
import { benchmarkDatabaseCreation } from "../fixtures/database";
import { setupTestContext } from "../utils/test-utils";

describe("Database Setup Performance", () => {
  const ctx = setupTestContext();

  test("measure database creation overhead", () => {
    const result = benchmarkDatabaseCreation(1000);
    
    console.log("\nDatabase Creation Performance:");
    console.log(`Total time: ${result.totalTime.toFixed(2)}ms`);
    console.log(`Average time per database: ${result.avgTimePerDb.toFixed(2)}ms`);
    console.log(`Operations per second: ${result.opsPerSecond.toFixed(2)}`);
    
    // Even with full schema, should still be very fast
    expect(result.avgTimePerDb).toBeLessThan(5); // 5ms is a conservative threshold
  });
  
  test("measure typical test operations", async () => {
    const startTime = performance.now();
    
    // Simulate a typical test setup
    const user = await ctx.factory.createUser();
    const workspace = await ctx.factory.createWorkspace({}, user);
    const channel = await ctx.factory.createChannel({}, workspace, user);
    
    // Add some test messages in a transaction
    ctx.db.transaction(() => {
      const stmt = ctx.db.prepare(`
        INSERT INTO messages (workspace_id, channel_id, sender_id, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (let i = 0; i < 10; i++) {
        const now = Date.now();
        stmt.run(
          workspace.id,
          channel.id,
          user.id,
          `Test message ${i}`,
          now,
          now
        );
      }
    })();
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    console.log(`\nTypical test setup time: ${totalTime.toFixed(2)}ms`);
    
    // A typical test setup should be reasonably fast
    expect(totalTime).toBeLessThan(50); // 50ms is a conservative threshold
  });
}); 