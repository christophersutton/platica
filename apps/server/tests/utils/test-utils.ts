import { Database } from "bun:sqlite";
import { beforeEach, afterEach } from "bun:test";
import { createTestDatabase } from "../fixtures/database";
import { TestFactory } from "../fixtures/factory";

/**
 * Test context that's available in each test
 */
export interface TestContext {
  db: Database;
  factory: TestFactory;
}

/**
 * Sets up test context before each test and cleans up after.
 * Usage:
 * ```ts
 * describe("MyTest", () => {
 *   const ctx = setupTestContext();
 *   
 *   test("my test", () => {
 *     const user = await ctx.factory.createUser();
 *     // ... rest of test
 *   });
 * });
 * ```
 */
export function setupTestContext(): TestContext {
  const ctx: TestContext = {} as TestContext;

  beforeEach(() => {
    ctx.db = createTestDatabase();
    ctx.factory = new TestFactory(ctx.db);
  });

  afterEach(() => {
    ctx.db.close();
  });

  return ctx;
} 