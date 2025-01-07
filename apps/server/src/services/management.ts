import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Database } from 'bun:sqlite';
import { DatabaseService } from '../db/database';
import type { Context } from 'hono';
import type { User, UserRole } from '@platica/shared/types';
import { AuthMiddleware } from '../middleware/auth';
import { ChannelRepository } from '../db/channel-repository';

type Variables = {
  user: Pick<User, 'id' | 'email'> & { userId: number };
  userRole?: UserRole;
};

export class ManagementService {
  public router: Hono;
  private auth: AuthMiddleware;
  private channelRepo: ChannelRepository;
  private readonly db: Database;

  constructor() {
    this.router = new Hono();
    // Use the singleton write instance
    const dbService = DatabaseService.getWriteInstance();
    this.db = dbService.db;
    this.auth = new AuthMiddleware(dbService);
    this.channelRepo = new ChannelRepository(dbService);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.router.use('/*', cors());
    this.router.use('/*', this.auth.jwtAuth);
    this.router.use('/workspaces/:workspaceId/*', this.auth.workspaceAuth);
  }

  private setupRoutes() {
    // Channel Management Routes
    this.router.post('/workspaces/:workspaceId/channels', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const userId = c.get('user').userId;
      const userRole = c.get('userRole');
      
      if (userRole !== 'admin') {
        return c.json({ error: 'Only workspace admins can create channels' }, 403);
      }

      const { name, description, is_private } = await c.req.json();
      
      const channel = this.channelRepo.createChannel({
        workspaceId,
        name,
        description,
        isPrivate: is_private,
        createdBy: userId
      });

      return c.json(channel);
    });

    this.router.patch('/workspaces/:workspaceId/channels/:channelId', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const channelId = Number(c.req.param('channelId'));
      const userRole = c.get('userRole');
      
      if (userRole !== 'admin') {
        return c.json({ error: 'Only workspace admins can edit channels' }, 403);
      }

      const { name, description } = await c.req.json();
      
      this.db.prepare(`
        UPDATE channels 
        SET name = ?, description = ?, updated_at = unixepoch()
        WHERE id = ? AND workspace_id = ?
      `).run(name, description, channelId, workspaceId);

      return c.json({ success: true });
    });

    this.router.delete('/workspaces/:workspaceId/channels/:channelId', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const channelId = Number(c.req.param('channelId'));
      const userRole = c.get('userRole');
      
      if (userRole !== 'admin') {
        return c.json({ error: 'Only workspace admins can archive channels' }, 403);
      }

      // Archive instead of delete to preserve history
      this.db.prepare(`
        UPDATE channels 
        SET is_archived = 1, updated_at = unixepoch()
        WHERE id = ? AND workspace_id = ?
      `).run(channelId, workspaceId);

      return c.json({ success: true });
    });

    // Channel Invite Routes
    this.router.post('/workspaces/:workspaceId/channels/:channelId/invites', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const channelId = Number(c.req.param('channelId'));
      const inviterId = c.get('user').userId;
      
      // Check if channel is private and user is a member
      const channel = this.db.prepare(`
        SELECT is_private FROM channels 
        WHERE id = ? AND workspace_id = ?
      `).get(channelId, workspaceId) as { is_private: boolean };

      if (channel?.is_private) {
        const isMember = this.channelRepo.hasChannelAccess(channelId, inviterId);
        if (!isMember) {
          return c.json({ error: 'Only channel members can invite to private channels' }, 403);
        }
      }

      const { user_ids } = await c.req.json();
      const invites: any[] = [];

      this.db.transaction(() => {
        for (const inviteeId of user_ids) {
          // Check if user is in workspace
          const isWorkspaceMember = this.db.prepare(`
            SELECT 1 FROM workspace_users 
            WHERE workspace_id = ? AND user_id = ?
          `).get(workspaceId, inviteeId);

          if (!isWorkspaceMember) continue;

          // Check if already a member
          const isChannelMember = this.channelRepo.hasChannelAccess(channelId, inviteeId);
          if (isChannelMember) continue;

          // Create invite
          const result = this.db.prepare(`
            INSERT INTO channel_invites (
              channel_id, inviter_id, invitee_id, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', unixepoch(), unixepoch())
          `).run(channelId, inviterId, inviteeId);

          invites.push({
            id: result.lastInsertRowid,
            channel_id: channelId,
            inviter_id: inviterId,
            invitee_id: inviteeId,
            status: 'pending'
          });
        }
      })();

      return c.json({ invites });
    });

    this.router.post('/channels/invites/:inviteId/respond', async (c: Context<{ Variables: Variables }>) => {
      const inviteId = Number(c.req.param('inviteId'));
      const userId = c.get('user').userId;
      const { accept } = await c.req.json();
      
      const invite = this.db.prepare(`
        SELECT * FROM channel_invites 
        WHERE id = ? AND invitee_id = ? AND status = 'pending'
      `).get(inviteId, userId) as any;

      if (!invite) {
        return c.json({ error: 'Invalid or expired invite' }, 404);
      }

      this.db.transaction(() => {
        // Update invite status
        this.db.prepare(`
          UPDATE channel_invites 
          SET status = ?, updated_at = unixepoch()
          WHERE id = ?
        `).run(accept ? 'accepted' : 'rejected', inviteId);

        if (accept) {
          // Add user to channel
          this.db.prepare(`
            INSERT INTO channel_members (channel_id, user_id, created_at)
            VALUES (?, ?, unixepoch())
          `).run(invite.channel_id, userId);
        }
      })();

      return c.json({ success: true });
    });

    // Workspace Invite Routes
    this.router.post('/workspaces/:workspaceId/invites', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const inviterId = c.get('user').userId;
      const userRole = c.get('userRole');
      
      if (userRole !== 'admin') {
        return c.json({ error: 'Only workspace admins can invite users' }, 403);
      }

      const { emails } = await c.req.json();
      const invites: any[] = [];

      this.db.transaction(() => {
        for (const email of emails) {
          // Check if invite already exists
          const existingInvite = this.db.prepare(`
            SELECT 1 FROM workspace_invites 
            WHERE workspace_id = ? AND email = ? AND status = 'pending'
          `).get(workspaceId, email);

          if (existingInvite) continue;

          // Create invite
          const result = this.db.prepare(`
            INSERT INTO workspace_invites (
              workspace_id, inviter_id, email, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', unixepoch(), unixepoch())
          `).run(workspaceId, inviterId, email);

          invites.push({
            id: result.lastInsertRowid,
            workspace_id: workspaceId,
            inviter_id: inviterId,
            email,
            status: 'pending'
          });

          // TODO: Send invitation email
        }
      })();

      return c.json({ invites });
    });

    this.router.get('/workspaces/:workspaceId/invites', async (c: Context<{ Variables: Variables }>) => {
      const workspaceId = Number(c.req.param('workspaceId'));
      const userRole = c.get('userRole');
      
      if (userRole !== 'admin') {
        return c.json({ error: 'Only workspace admins can view invites' }, 403);
      }

      const invites = this.db.prepare(`
        SELECT 
          wi.*,
          u.name as inviter_name,
          u.avatar_url as inviter_avatar_url
        FROM workspace_invites wi
        JOIN users u ON wi.inviter_id = u.id
        WHERE wi.workspace_id = ?
        ORDER BY wi.created_at DESC
      `).all(workspaceId);

      return c.json({ invites });
    });
  }
} 
