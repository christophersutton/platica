/*
  File: auth.ts

  Some references previously pointed to channel_members, 
  we fix them to hub_members. 
  Also remove or rename references to "channel" if needed. 
*/

import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { Database } from 'bun:sqlite';
import { DatabaseService } from '../db/core/database';
import type { User, UserRole } from '@models';

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

    // If not a member, check if it's a public or private hub
    const hubCheck = this.db.prepare(`
      SELECT workspace_id, is_archived 
      FROM hubs
      WHERE id = ?
    `).get(hubId) as { workspace_id: number; is_archived: number } | undefined;

    if (!hubCheck) {
      return c.json({ error: 'Hub not found' }, 404);
    }

    // Simplified assumption: if not a member, user can't access the hub
    // (In some code, we might check if the hub is public. 
    // If so, auto-join. But here we just block.)
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

  // (Optional) Room-specific auth could be added similarly 
  // using the new domain references if needed.
}