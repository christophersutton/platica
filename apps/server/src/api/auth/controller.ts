import type { Context } from "hono";
import { sign } from "hono/jwt";
import { BaseController, ApiError } from "../base-controller";
import type { Database } from "bun:sqlite";
import { UserRepository } from "../../db/repositories/user-repository.js";
import { EmailService } from "../../services/email.js";
import { WorkspaceRepository } from "../../db/repositories/workspace-repository.js";


const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const MAGIC_LINK_EXPIRY = 15 * 60; // 15 minutes in seconds

interface MagicLinkBody {
  email: string;
  workspaceId?: string;
}

interface VerifyTokenBody {
  token: string;
}

interface UpdateProfileBody {
  name?: string;
  avatar_url?: string;
}

export class AuthController extends BaseController {
  
  private readonly userRepo: UserRepository;
  private readonly workspaceRepo: WorkspaceRepository;

  constructor(userRepo: UserRepository, workspaceRepo: WorkspaceRepository) {
    super();
    this.userRepo = userRepo;
    this.workspaceRepo = workspaceRepo;
  }

  static create(db: Database): AuthController {
    return new AuthController(
      new UserRepository(db),
      new WorkspaceRepository(db)
    );
  }

  requestMagicLink = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { email, workspaceId } = await this.requireBody<MagicLinkBody>(c);

      // Create or get user
      const user = await this.userRepo.findOrCreate(email, workspaceId ? parseInt(workspaceId, 10) : undefined);

      // Generate and store token with workspace context
      const token = await this.userRepo.createAuthToken({
        userId: user.id,
        expiresAt: Math.floor(Date.now() / 1000) + MAGIC_LINK_EXPIRY,
        workspaceId: workspaceId ? parseInt(workspaceId, 10) : undefined,
      });

      // Generate magic link
      const magicLink = `${process.env.APP_URL}/auth/verify?token=${token}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`;
      
      await EmailService.sendMagicLink(email, magicLink);

      return { message: "Magic link sent to your email" };
    });
  };

  verifyToken = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      try {
        console.log("Verifying token...");
        const body = await c.req.json();
        console.log("Request body:", body);
        
        if (!body || typeof body.token !== 'string') {
          console.error("Invalid request body:", body);
          throw new ApiError("Invalid token format", 400);
        }

        const { token } = body;

        // Verify and consume token
        console.log("Verifying token with repository...");
        const authToken = await this.userRepo.verifyAndConsumeToken(token);
        if (!authToken) {
          console.error("Token verification failed");
          throw new ApiError("Invalid or expired token", 401);
        }
        console.log("Token verified successfully");

        // Get user info
        console.log("Fetching user...");
        const user = await this.userRepo.findById(authToken.userId);
        if (!user) {
          console.error("User not found for token:", authToken);
          throw new ApiError("User not found", 404);
        }
        console.log("User found:", user.id);

        // If this is a workspace invite, add user to workspace
        if (authToken.workspaceId) {
          console.log("Adding user to workspace:", authToken.workspaceId);
          await this.workspaceRepo.addUser(authToken.workspaceId, user.id);
        }

        // Generate JWT
        console.log("Generating JWT...");
        const jwt = await sign(
          {
            id: user.id,
            email: user.email,
          },
          JWT_SECRET
        );
        console.log("JWT generated successfully");

        return {
          token: jwt,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          workspaceId: authToken.workspaceId,
        };
      } catch (error) {
        console.error("Token verification error:", error);
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError("Failed to verify token", 500);
      }
    });
  };

  getProfile = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { userId } = c.get("user");
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new ApiError("User not found", 404);
      }
      return user;
    });
  };

  updateProfile = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { userId } = c.get("user");
      const data = await this.requireBody<UpdateProfileBody>(c);
      const user = await this.userRepo.update(userId, data);
      if (!user) {
        throw new ApiError("Failed to update user", 500);
      }
      return user;
    });
  };
}
