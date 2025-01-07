import { describe, expect, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { AuthRepository } from "../../../src/db/repositories/auth-repository";
import type { User } from "@platica/shared";

describe("AuthRepository", () => {
  let db: Database;
  let authRepo: AuthRepository;

  beforeEach(() => {
    // Create an in-memory database for testing
    db = new Database(":memory:");
    
    // Set up schema
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used BOOLEAN NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    authRepo = new AuthRepository(db);
  });

  describe("findByEmail", () => {
    test("returns null for non-existent email", async () => {
      const user = await authRepo.findByEmail("nonexistent@example.com");
      expect(user).toBeNull();
    });

    test("returns user for existing email", async () => {
      // Create a user first
      const email = "test@example.com";
      await authRepo.create({
        email,
        name: "Test User",
        avatar_url: null
      });

      const user = await authRepo.findByEmail(email);
      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
      expect(user?.name).toBe("Test User");
    });
  });

  describe("findOrCreate", () => {
    test("creates a new user when email doesn't exist", async () => {
      const email = "test@example.com";
      const user = await authRepo.findOrCreate(email);

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.name).toBe("test"); // Default name from email
      expect(user.id).toBeGreaterThan(0);
    });

    test("returns existing user when email exists", async () => {
      const email = "test@example.com";
      const firstUser = await authRepo.findOrCreate(email);
      const secondUser = await authRepo.findOrCreate(email);

      expect(secondUser.id).toBe(firstUser.id);
      expect(secondUser.email).toBe(email);
    });

    test("handles emails with multiple @ symbols for username", async () => {
      const email = "test@subdomain@example.com";
      const user = await authRepo.findOrCreate(email);
      expect(user.name).toBe("test"); // Should only use part before first @
    });
  });

  describe("createAuthToken", () => {
    test("creates a valid auth token", async () => {
      const user = await authRepo.findOrCreate("test@example.com");
      const expiresAt = Date.now() + 900000; // 15 minutes

      const token = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: expiresAt
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);

      // Verify token exists in database
      const dbToken = db.prepare("SELECT * FROM auth_tokens WHERE token = ?").get(token) as { user_id: number; used: number };
      expect(dbToken).toBeDefined();
      expect(dbToken.user_id).toBe(user.id);
      expect(dbToken.used).toBe(0);
    });

    test("creates unique tokens for same user", async () => {
      const user = await authRepo.findOrCreate("test@example.com");
      const expiresAt = Date.now() + 900000;

      const token1 = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: expiresAt
      });

      const token2 = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: expiresAt
      });

      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyAndConsumeToken", () => {
    test("verifies and consumes a valid token", async () => {
      const user = await authRepo.findOrCreate("test@example.com");
      const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes in seconds
      
      const token = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: expiresAt
      });

      const authToken = await authRepo.verifyAndConsumeToken(token);
      expect(authToken).toBeDefined();
      expect(authToken?.user_id).toBe(user.id);
      expect(Boolean(authToken?.used)).toBe(false); // Convert SQLite integer to boolean

      // Verify token is marked as used in database
      const dbToken = db.prepare("SELECT * FROM auth_tokens WHERE token = ?").get(token) as { used: number };
      expect(dbToken.used).toBe(1);

      // Try to verify again - should fail
      const secondAttempt = await authRepo.verifyAndConsumeToken(token);
      expect(secondAttempt).toBeUndefined();
    });

    test("rejects expired tokens", async () => {
      const user = await authRepo.findOrCreate("test@example.com");
      const expiresAt = Math.floor(Date.now() / 1000) - 1; // Expired (1 second ago)
      
      const token = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: expiresAt
      });

      const authToken = await authRepo.verifyAndConsumeToken(token);
      expect(authToken).toBeUndefined();
    });

    test("rejects already used tokens", async () => {
      const user = await authRepo.findOrCreate("test@example.com");
      const expiresAt = Math.floor(Date.now() / 1000) + 900;
      
      const token = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: expiresAt
      });

      // Use token once
      await authRepo.verifyAndConsumeToken(token);

      // Try to use again
      const secondAttempt = await authRepo.verifyAndConsumeToken(token);
      expect(secondAttempt).toBeUndefined();
    });
  });

  describe("deleteExpiredTokens", () => {
    test("deletes only expired tokens", async () => {
      const user = await authRepo.findOrCreate("test@example.com");
      
      // Create expired token
      const expiredToken = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: Math.floor(Date.now() / 1000) - 1
      });

      // Create valid token
      const validToken = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: Math.floor(Date.now() / 1000) + 900
      });

      await authRepo.deleteExpiredTokens();

      // Check expired token is deleted
      const expiredCheck = db.prepare("SELECT * FROM auth_tokens WHERE token = ?").get(expiredToken);
      expect(expiredCheck).toBeNull();

      // Check valid token still exists
      const validCheck = db.prepare("SELECT * FROM auth_tokens WHERE token = ?").get(validToken);
      expect(validCheck).toBeDefined();
    });
  });
}); 