import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, Next } from 'hono';
import { rateLimit } from '../middleware/rate-limiter';
import { AuthMiddleware } from '../middleware/auth';
import { MessageRepository } from '../db/messages-repository';
import { ChannelRepository } from '../db/channel-repository';
import { DatabaseService } from '../db/database';
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

  constructor(serviceId: string = 'read') {
    // Get a read-only database instance for this service
    this.db = DatabaseService.getReadInstance(serviceId);
    
    this.router = new Hono();
    this.auth = new AuthMiddleware(this.db);
    this.messageRepo = new MessageRepository(this.db);
    this.channelRepo = new ChannelRepository(this.db);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.router.use('/*', cors());
    
    // Rate limits
    this.router.use('/channels/*/messages', rateLimit(this.db, {
      windowMs: 60 * 1000,
      max: 120,
      keyGenerator: (c: Context) => `read:${c.get('user').userId}`
    }));

    // Apply auth middleware to route groups
    this.router.use('/channels/:channelId/*', this.auth.channelAuth);
    this.router.use('/workspaces/:workspaceId/*', this.auth.workspaceAuth);
  }

  private setupRoutes() {
    this.router.get('/channels/:channelId/messages', async (c: Context<{ Variables: Variables }>) => {
      const channelId = Number(c.req.param('channelId'));
      const userId = c.get('user').userId;
      const before = c.req.query('before');
      const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

      const messages = await this.messageRepo.getChannelMessages(channelId, before ? Number(before) : undefined, limit);
      await this.messageRepo.updateLastRead(channelId, userId);

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

      const channels = await this.channelRepo.getWorkspaceChannels(workspaceId, userId, userRole);
      return c.json({ channels });
    });

    this.router.get('/channels/:channelId/members', async (c: Context<{ Variables: Variables }>) => {
      const channelId = Number(c.req.param('channelId'));
      const members = await this.messageRepo.getChannelMembers(channelId);
      return c.json({ members });
    });
  }
}