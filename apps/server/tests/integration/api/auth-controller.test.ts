import { describe, expect, test, beforeEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { AuthController } from "../../../src/api/auth/controller";
import { AuthRepository } from "../../../src/db/repositories/auth-repository";
import { EmailService } from "../../../src/services/email";
import type { Context } from "hono";
import type { ApiResponse } from "../../../src/api/base-controller";

// Mock the EmailService
mock.module("../../../src/services/email", () => ({
  EmailService: {
    sendMagicLink: mock(() => Promise.resolve())
  }
}));

interface MagicLinkResponse {
  token?: string;
  magicLink?: string;
  message?: string;
}

interface VerifyResponse {
  token?: string;
  user?: {
    id: number;
    email: string;
    name?: string;
  };
  error?: string;
}

interface ProfileResponse {
  id: number;
  email: string;
  name?: string;
  avatar_url?: string;
}

// Helper to create a mock Context
function createMockContext(data: any = {}, status = 200): Context {
  return {
    req: {
      json: () => Promise.resolve(data)
    },
    json: (responseData: any) => {
      return new Response(JSON.stringify(responseData), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    get: (key: string) => data[key],
    set: (key: string, value: any) => {},
  } as unknown as Context;
}

describe("AuthController", () => {
  let db: Database;
  let controller: AuthController;

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

    controller = AuthController.create(db);
  });

  describe("requestMagicLink", () => {
    test("creates new user and returns magic link in development", async () => {
      process.env.NODE_ENV = "development";
      
      const mockContext = createMockContext({ email: "test@example.com" });
      const response = await controller.requestMagicLink(mockContext);
      const { data } = await response.json() as ApiResponse<MagicLinkResponse>;

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data?.token).toBeDefined();
      expect(data?.magicLink).toBeDefined();
      expect(data?.magicLink).toContain(data?.token);
      expect(data?.message).toBe("Magic link generated (development mode)");
    });

    test("sends email in production", async () => {
      process.env.NODE_ENV = "production";
      
      const mockContext = createMockContext({ email: "test@example.com" });
      const response = await controller.requestMagicLink(mockContext);
      const { data } = await response.json() as ApiResponse<MagicLinkResponse>;

      expect(response.status).toBe(200);
      expect(data?.message).toBe("Magic link sent to your email");
      expect(EmailService.sendMagicLink).toHaveBeenCalled();
    });
  });

  describe("verifyToken", () => {
    test("verifies valid token and returns JWT", async () => {
      // First create a user and token
      const authRepo = new AuthRepository(db);
      const user = await authRepo.findOrCreate("test@example.com");
      const token = await authRepo.createAuthToken({
        user_id: user.id,
        expires_at: Date.now() + 900000
      });

      const mockContext = createMockContext({ token });
      const response = await controller.verifyToken(mockContext);
      const { data } = await response.json() as ApiResponse<VerifyResponse>;

      expect(response.status).toBe(200);
      expect(data?.token).toBeDefined(); // JWT
      expect(data?.user).toBeDefined();
      expect(data?.user?.email).toBe("test@example.com");
    });

    test("rejects invalid token", async () => {
      const mockContext = createMockContext({ token: "invalid-token" }, 401);
      const response = await controller.verifyToken(mockContext);
      const { error } = await response.json() as ApiResponse;

      expect(response.status).toBe(401);
      expect(error).toBe("Invalid or expired token");
    });
  });

  describe("getProfile", () => {
    test("returns user profile for authenticated request", async () => {
      // Create a user first
      const authRepo = new AuthRepository(db);
      const user = await authRepo.findOrCreate("test@example.com");

      // The user object in context should match what JWT middleware sets
      const mockContext = createMockContext({ 
        user: { 
          id: user.id,
          email: user.email 
        }
      });
      
      const response = await controller.getProfile(mockContext);
      const { data } = await response.json() as ApiResponse<ProfileResponse>;

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data?.id).toBe(user.id);
      expect(data?.email).toBe("test@example.com");
    });
  });
}); 