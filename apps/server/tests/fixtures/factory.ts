import { Database } from "bun:sqlite";
import type { User, Workspace, Channel } from "@platica/shared/types";
import { UserRole } from "@platica/shared/types";

export class TestFactory {
  constructor(private db: Database) {}

  async createUser(overrides: Partial<User> = {}): Promise<User> {
    const now = Math.floor(Date.now() / 1000);
    const defaults = {
      email: `test-${now}@example.com`,
      name: `Test User ${now}`,
      avatar_url: null,
      created_at: now,
      updated_at: now,
      ...overrides
    };

    return this.db.prepare(`
      INSERT INTO users (email, name, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      defaults.email,
      defaults.name,
      defaults.avatar_url,
      defaults.created_at,
      defaults.updated_at
    ) as User;
  }

  async createWorkspace(overrides: Partial<Workspace> = {}, owner?: User): Promise<Workspace> {
    const now = Math.floor(Date.now() / 1000);
    const workspaceOwner = owner || await this.createUser();
    
    const defaults = {
      name: `Test Workspace ${now}`,
      slug: `test-workspace-${now}`,
      owner_id: workspaceOwner.id,
      icon_url: null,
      settings: {},
      created_at: now,
      updated_at: now,
      ...overrides
    };

    const workspace = this.db.prepare(`
      INSERT INTO workspaces (
        name, slug, owner_id, icon_url, settings,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      defaults.name,
      defaults.slug,
      defaults.owner_id,
      defaults.icon_url,
      JSON.stringify(defaults.settings),
      defaults.created_at,
      defaults.updated_at
    ) as Workspace;

    // Add owner to workspace_users
    this.db.prepare(`
      INSERT INTO workspace_users (workspace_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      workspace.id,
      workspaceOwner.id,
      UserRole.ADMIN,
      '{}',
      now,
      now
    );

    return workspace;
  }

  async createChannel(overrides: Partial<Channel> = {}, workspace?: Workspace, creator?: User): Promise<Channel> {
    const now = Math.floor(Date.now() / 1000);
    const channelWorkspace = workspace || await this.createWorkspace();
    const channelCreator = creator || await this.createUser();
    
    const defaults = {
      name: `test-channel-${now}`,
      description: null,
      is_private: false,
      is_archived: false,
      settings: {},
      created_at: now,
      updated_at: now,
      ...overrides
    };

    const channel = this.db.prepare(`
      INSERT INTO channels (
        workspace_id, name, description, is_private, is_archived,
        created_by, settings, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      channelWorkspace.id,
      defaults.name,
      defaults.description,
      defaults.is_private ? 1 : 0,  // SQLite boolean
      defaults.is_archived ? 1 : 0,  // SQLite boolean
      channelCreator.id,
      JSON.stringify(defaults.settings),
      defaults.created_at,
      defaults.updated_at
    ) as Channel;

    // Add creator as channel member
    await this.addUserToChannel(channelCreator, channel);

    return channel;
  }

  async addUserToChannel(user: User, channel: Channel): Promise<void> {
    // Check if user is already a member
    const exists = this.db.prepare(`
      SELECT 1 FROM channel_members 
      WHERE channel_id = ? AND user_id = ?
    `).get(channel.id, user.id);

    if (exists) return;

    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO channel_members (channel_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(channel.id, user.id, 'member', '{}', now, now);
  }
} 