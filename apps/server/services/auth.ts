import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { sign } from "hono/jwt";
import { randomBytes } from "crypto";
import type { User } from "@platica/shared/types";
import { rateLimit } from "../middleware/rate-limiter";
import { DatabaseService } from "../db/database";
import { EmailService } from "./email";
import type { Context } from "hono";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const MAGIC_LINK_EXPIRY = 15 * 60 * 1000;

interface AuthToken {
  token: string;
  user_id: number;
  expires_at: number;
  used: number;
  created_at: number;
}

export class AuthService {
  public router: Hono;
  private readonly db: Database;

  constructor() {
    this.router = new Hono();
    // Use the singleton write instance
    const dbService = DatabaseService.getWriteInstance();
    this.db = dbService.db;
    this.setupDatabase();
    this.setupRoutes();
    
    // Clean up expired tokens periodically
    setInterval(() => this.cleanupTokens(), 60 * 60 * 1000); // Every hour
  }

  private setupDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER,
        expires_at INTEGER NOT NULL,
        used BOOLEAN NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
  }

  private setupRoutes() {
    this.setupMiddleware();

    // Request magic link
    this.router.post("/magic-link", async (c) => {
      const { email } = await c.req.json();

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return c.json({ error: "Invalid email address" }, 400);
      }

      try {
        // Find or create user
        let user = this.db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(email) as User | undefined;
        
        if (!user) {
          const result = this.db
            .prepare(
              "INSERT INTO users (email, name, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())"
            )
            .run(email, email.split("@")[0]);
          user = {
            id: result.lastInsertRowid as number,
            email,
            name: email.split("@")[0],
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          };
        }

        // Generate and store token
        const token = randomBytes(32).toString("hex");
        const expiresAt = Date.now() + MAGIC_LINK_EXPIRY;

        this.db
          .prepare(
            `
          INSERT INTO auth_tokens (token, user_id, expires_at, created_at)
          VALUES (?, ?, ?, unixepoch())
        `
          )
          .run(token, user.id, expiresAt);

        // Send magic link email
        const magicLink = `${process.env.APP_URL}/auth/verify?token=${token}`;
        
        // In development, return the magic link directly
        if (process.env['NODE_ENV'] !== 'production') {
          return c.json({ 
            message: "Magic link generated (development mode)",
            magicLink,
            token // Include token directly for testing
          });
        }
        
        // In production, send email
        await EmailService.sendMagicLink(email, magicLink);
        return c.json({ message: "Magic link sent" });
      } catch (error) {
        console.error('Failed to send magic link:', error);
        return c.json({ error: "Failed to send magic link" }, 500);
      }
    });

    // Verify magic link and issue JWT
    this.router.post("/verify", async (c) => {
      const { token } = await c.req.json();

      if (!token || typeof token !== 'string') {
        return c.json({ error: "Invalid token" }, 400);
      }

      try {
        const authToken = this.db
          .prepare(
            `
          SELECT * FROM auth_tokens 
          WHERE token = ? 
          AND used = 0 
          AND expires_at > ?
        `
          )
          .get(token, Date.now()) as AuthToken | undefined;

        if (!authToken) {
          return c.json({ error: "Invalid or expired token" }, 400);
        }

        // Mark token as used
        this.db
          .prepare("UPDATE auth_tokens SET used = 1 WHERE token = ?")
          .run(token);

        // Get user info
        const user = this.db
          .prepare("SELECT * FROM users WHERE id = ?")
          .get(authToken.user_id) as User;

        // Generate JWT
        const jwt = await sign(
          {
            id: user.id,
            email: user.email,
          },
          JWT_SECRET
        );

        return c.json({ token: jwt, user });
      } catch (error) {
        console.error('Failed to verify token:', error);
        return c.json({ error: "Failed to verify token" }, 500);
      }
    });
  }

  private setupMiddleware() {
    this.router.use("/*", cors());

    // Rate limit for magic link requests
    this.router.use(
      "/magic-link",
      rateLimit(this.db, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per IP
        keyGenerator: (c: Context) =>
          `auth:magic-link:${c.req.header("x-forwarded-for") || "unknown"}`,
      })
    );

    // Rate limit for token verification
    this.router.use(
      "/verify",
      rateLimit(this.db, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 attempts per IP
        keyGenerator: (c: Context) =>
          `auth:verify:${c.req.header("x-forwarded-for") || "unknown"}`,
      })
    );
  }

  // Helper to clean up expired tokens
  private async cleanupTokens() {
    try {
      this.db
        .prepare("DELETE FROM auth_tokens WHERE expires_at < ?")
        .run(Date.now());
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }
}
