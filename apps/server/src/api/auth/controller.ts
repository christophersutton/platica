import type { Context } from 'hono';
import { sign } from 'hono/jwt';
import { BaseController, ApiError } from '../base-controller';
import type { Database } from 'bun:sqlite';
import { AuthRepository } from '../../db/repositories/auth-repository.js';
import { EmailService } from '../../services/email.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes

interface MagicLinkBody {
  email: string;
}

interface VerifyTokenBody {
  token: string;
}

interface UpdateProfileBody {
  name?: string;
  avatar_url?: string;
}

export class AuthController extends BaseController {
  private readonly authRepo: AuthRepository;

  constructor(authRepo: AuthRepository) {
    super();
    this.authRepo = authRepo;
  }

  static create(db: Database): AuthController {
    return new AuthController(new AuthRepository(db));
  }

  requestMagicLink = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { email } = await this.requireBody<MagicLinkBody>(c);

      // Create or get user
      const user = await this.authRepo.findOrCreate(email);

      // Generate and store token
      const token = await this.authRepo.createAuthToken({
        user_id: user.id,
        expires_at: Date.now() + MAGIC_LINK_EXPIRY
      });

      // Generate magic link
      const magicLink = `${process.env.APP_URL}/auth/verify?token=${token}`;

      // In development, return the token directly
      if (process.env.NODE_ENV === 'development') {
        return {
          message: 'Magic link generated (development mode)',
          magicLink,
          token
        };
      }

      // In production, send email
      if (process.env.NODE_ENV === 'production') {
        // Send magic link via email
        await EmailService.sendMagicLink(email, magicLink);
      }

      return { message: 'Magic link sent to your email' };
    });
  };

  verifyToken = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const { token } = await this.requireBody<VerifyTokenBody>(c);

      // Verify and consume token
      const authToken = await this.authRepo.verifyAndConsumeToken(token);
      if (!authToken) {
        throw new ApiError('Invalid or expired token', 401);
      }

      // Get user
      const user = await this.authRepo.findById(authToken.user_id);
      if (!user) {
        throw new ApiError('User not found', 404);
      }

      // Generate JWT
      const jwt = await sign({
        id: user.id,
        email: user.email
      }, JWT_SECRET);

      return {
        token: jwt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      };
    });
  };

  getProfile = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const userId = c.get('user').id;
      const user = await this.authRepo.findById(userId);
      return user;
    });
  };

  updateProfile = async (c: Context): Promise<Response> => {
    return this.handle(c, async () => {
      const userId = c.get('user').id;
      const data = await this.requireBody<UpdateProfileBody>(c);
      const user = await this.authRepo.update(userId, data);
      return c.json(user);
    });
  };
} 