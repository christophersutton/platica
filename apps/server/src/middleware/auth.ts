import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { Database } from 'bun:sqlite';
import { DatabaseService } from '../db/core/database';
import type { User, UserRole } from '@platica/shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export type Variables = {
  user: Pick<User, 'id' | 'email'> & { userId: number };
  userRole?: UserRole;
};

export class AuthMiddleware {
  private readonly db: Database;

  constructor(db: Database | DatabaseService) {
    this.db = db instanceof DatabaseService ? db.db : db;
  }

  // JWT verification middleware
  jwtAuth = async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = await verify(token, JWT_SECRET);
      
      // Map the payload to the expected user structure
      c.set('user', {
        userId: payload.id,
        email: payload.email
      });
      
      await next();
    } catch (e) {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }

  // Hub-specific authorization
  hubAuth = async (c: Context<{ Variables: Variables }, '/hubs/:hubId/*'>, next: Next) => {
    const hubId = Number(c.req.param('hubId'));
    const userId = c.get('user').userId;

    // First check if user is already a member
    const isMember = this.db.prepare(`
      SELECT 1 FROM hub_members 
      WHERE hub_id = ? AND user_id = ?
    `).get(hubId, userId);

    if (isMember) {
      await next();
      return;
    }

    // If not a member, check if it's a public hub

    const hub
 = this.db.prepare(`
      SELECT workspace_id, is_private FROM hubs
      WHERE id = ?
    `).get(hubId) as { workspace_id: number, is_private: boolean } | undefined;

    if (!hub
) {
      return c.json({ error: 'Hub not found' }, 404);
    }

    if (!hub
.is_private) {
      // Auto-join public hub

      const now = Math.floor(Date.now() / 1000);
      this.db.prepare(`
        INSERT INTO hub_members (hub_id, user_id, role, settings, created_at, updated_at)
        VALUES (?, ?, 'member', '{}', ?, ?)
      `).run(hubId, userId, now, now);

      // Note: We can't broadcast the member_joined event here since we don't have access to the WebSocket service
      // The controller's ensureHubAccess will handle that when it's called

      await next();
      return;
    }

    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Workspace-specific authorization
  workspaceAuth = async (c: Context<{ Variables: Variables }, '/workspaces/:workspaceId/*'>, next: Next) => {
    const workspaceId = Number(c.req.param('workspaceId'));
    const userId = c.get('user').userId;

    const userRole = this.db.prepare(`
      SELECT role FROM workspace_users 
      WHERE workspace_id = ? AND user_id = ?
    `).get(workspaceId, userId) as { role: UserRole } | undefined;

    if (!userRole) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    c.set('userRole', userRole.role);
    await next();
  }
}