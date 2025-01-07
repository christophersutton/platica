import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load and cache schema at module level for better performance
const schema = readFileSync(join(__dirname, "../../src/db/schema/tables/setup.sql"), "utf-8");

/**
 * Creates a new in-memory test database with the full schema loaded.
 * Uses Bun's SQLite implementation which is extremely fast.
 * Each test should get its own database instance for isolation.
 */
export function createTestDatabase() {
  const db = new Database(":memory:");
  
  // Enable foreign keys and run all schema setup in a single transaction
  db.exec("PRAGMA foreign_keys = ON;");
  db.transaction(() => {
    db.exec(schema);
  })();
  
  return db;
}

/**
 * Benchmark database creation performance.
 * This helps us monitor if schema changes impact test performance.
 */
export function benchmarkDatabaseCreation(iterations: number = 1000) {
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const db = createTestDatabase();
    db.close();
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  
  return {
    iterations,
    totalTime,
    avgTimePerDb: avgTime,
    opsPerSecond: 1000 / avgTime
  };
} 