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
  const { body, ...contextData } = data;
  return {
    req: {
      json: () => {
        // For endpoints that expect body data
        if (body) return Promise.resolve(body);
        // For endpoints that read data directly
        if ('email' in data || 'token' in data) return Promise.resolve(data);
        return Promise.resolve({});
      },
      param: () => undefined,
      query: () => undefined
    },
    json: (responseData: any, status?: number) => {
      return new Response(JSON.stringify(responseData), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    get: (key: string) => {
      // Special handling for user data to match real behavior
      if (key === 'user') {
        return contextData.user || {};
      }
      return contextData[key];
    },
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
          userId: user.id,
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

  describe("complete auth flow", () => {
    test("should allow profile access after successful token verification", async () => {
      process.env.NODE_ENV = "development";
      const email = "test@example.com";
      
      // Step 1: Request magic link
      const requestContext = createMockContext({ email });
      const magicLinkResponse = await controller.requestMagicLink(requestContext);
      const { data: magicLinkData } = await magicLinkResponse.json() as ApiResponse<MagicLinkResponse>;
      expect(magicLinkData?.token).toBeDefined();
      if (!magicLinkData?.token) throw new Error("No token in response");

      // Step 2: Verify token
      const verifyContext = createMockContext({ token: magicLinkData.token });
      const verifyResponse = await controller.verifyToken(verifyContext);
      const { data: verifyData } = await verifyResponse.json() as ApiResponse<VerifyResponse>;
      expect(verifyData?.token).toBeDefined();
      expect(verifyData?.user).toBeDefined();
      if (!verifyData?.user) throw new Error("No user in response");
      expect(verifyData.user.email).toBe(email);

      // Step 3: Access profile with JWT
      const profileContext = createMockContext({
        user: { userId: verifyData.user.id, email: verifyData.user.email }
      });
      const profileResponse = await controller.getProfile(profileContext);
      const { data: profileData } = await profileResponse.json() as ApiResponse<ProfileResponse>;
      
      expect(profileResponse.status).toBe(200);
      expect(profileData?.email).toBe(email);
      expect(profileData?.id).toBe(verifyData.user.id);
    });

    test("should handle profile access with incorrect user ID format", async () => {
      // First create a user to ensure we're testing the ID format issue, not a missing user
      const authRepo = new AuthRepository(db);
      const user = await authRepo.findOrCreate("test@example.com");

      // Test the case that was causing the bug
      const profileContext = createMockContext({
        user: { id: user.id, email: "test@example.com" } // Using 'id' instead of 'userId'
      }, 404);
      
      const response = await controller.getProfile(profileContext);
      const { error } = await response.json() as ApiResponse<ProfileResponse>;
      
      expect(response.status).toBe(404);
      expect(error).toBe("User not found");
    });

    test("should handle profile update with correct user ID format", async () => {
      // First create a user
      const email = "test@example.com";
      const authRepo = new AuthRepository(db);
      const user = await authRepo.findOrCreate(email);
      
      // Test profile update - separate user context from update data
      const updateData = {
        name: "Test User",
        avatar_url: "https://example.com/avatar.jpg"
      };
      
      // Create context with user data and update data
      const updateContext = createMockContext({
        user: { userId: user.id, email }
      });
      
      // Mock the req.json() method to return the update data
      updateContext.req.json = async () => {
        return updateData as any;
      };
      
      const response = await controller.updateProfile(updateContext);
      const responseText = await response.text();
      
      // Check if the user was actually updated in the database
      const updatedUser = await authRepo.findById(user.id);
      
      const { data } = JSON.parse(responseText) as ApiResponse<ProfileResponse>;
      
      expect(response.status).toBe(200);
      expect(data?.id).toBe(user.id);
      expect(data?.email).toBe(email);
      expect(data?.name).toBe(updateData.name);
      expect(data?.avatar_url).toBe(updateData.avatar_url);
    });
  });
}); 