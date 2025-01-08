import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, Next } from 'hono';
import { rateLimit } from '../middleware/rate-limiter';
import { AuthMiddleware } from '../middleware/auth';
import { MessageRepository } from '../db/repositories/message-repository';
import { ChannelRepository } from '../db/repositories/channel-repository';
import { DatabaseService } from '../db/core/database';
import type { User, UserRole } from '@platica/shared/types';

type Variables = {
  user: Pick<User, 'id' | 'email'> & { userId: number };
  userRole?: UserRole;
};

export class ReadService {
  public router: Hono;
  private auth: AuthMiddleware;
  private messageRepo: MessageRepository;
  private channelRepo: ChannelRepository;
  private db: DatabaseService;

  constructor() {
    // Get a read-only database instance for this service
    const dbService = DatabaseService.getReadInstance('read-service');
    this.db = dbService;
    
    this.router = new Hono();
    this.auth = new AuthMiddleware(dbService.db);
    this.messageRepo = new MessageRepository(dbService.db);
    this.channelRepo = new ChannelRepository(dbService.db);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.router.use('/*', cors());
    
    // Apply JWT auth middleware first
    this.router.use('/*', this.auth.jwtAuth);
    
    // Rate limits (after JWT auth since it needs user info)
    this.router.use('/channels/*/messages', rateLimit(this.db.db, {
      windowMs: 60 * 1000,
      max: 120,
      keyGenerator: (c: Context) => `read:${c.get('user').userId}`
    }));

    // Apply route-specific auth middleware
    this.router.use('/channels/:channelId/*', this.auth.channelAuth);
    this.router.use('/workspaces/:workspaceId/*', this.auth.workspaceAuth);
  }

  private setupRoutes() {
    this.router.get('/channels/:channelId/messages', async (c: Context<{ Variables: Variables }>) => {
      const channelId = Number(c.req.param('channelId'));
      const userId = c.get('user').userId;
      const before = c.req.query('before');
      const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

      const messages = await this.messageRepo.findByChannel(channelId, limit, before ? Number(before) : undefined);
      await this.channelRepo.updateMember(channelId, userId, {
        last_read_at: Math.floor(Date.now() / 1000)
      });

      return c.json({ messages });
    });

    this.router.get('/channels/:channelId/threads/:threadId', async (c: Context<{ Variables: Variables }>) => {
      const channelId = Number(c.req.param('channelId'));
      const threadId = Number(c.req.param('threadId'));
      const thread = await this.messageRepo.getThreadMessages(channelId, threadId);
      return c.json({ thread });
    });

    this.router.get('/workspaces/:workspaceId/channels', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const userId = c.get('user').userId;
      const userRole = c.get('userRole') || 'member';

      const channels = await this.channelRepo.findByWorkspace(workspaceId, userId);
      return c.json({ channels });
    });

    this.router.get('/channels/:channelId/members', async (c: Context<{ Variables: Variables }>) => {
      const channelId = Number(c.req.param('channelId'));
      const members = await this.channelRepo.findMembers(channelId);
      return c.json({ members });
    });
  }
}
