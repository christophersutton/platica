import { Database } from "bun:sqlite";
import type { User, Workspace, Hub } from "@platica/shared/types";
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

  async createHub(overrides: Partial<Hub> = {}, workspace?: Workspace, creator?: User): Promise<Hub> {
    const now = Math.floor(Date.now() / 1000);
    const hubWorkspace = workspace || await this.createWorkspace();
    const hubCreator = creator || await this.createUser();
    
    const defaults = {
      name: `test-hub
-${now}`,
      description: null,
      is_private: false,
      is_archived: false,
      settings: {},
      created_at: now,
      updated_at: now,
      ...overrides
    };

    const hub
 = this.db.prepare(`
      INSERT INTO hubs (
        workspace_id, name, description, is_private, is_archived,
        created_by, settings, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      hubWorkspace.id,
      defaults.name,
      defaults.description,
      defaults.is_private ? 1 : 0,  // SQLite boolean
      defaults.is_archived ? 1 : 0,  // SQLite boolean
      hubCreator.id,
      JSON.stringify(defaults.settings),
      defaults.created_at,
      defaults.updated_at
    ) as Hub;

    // Add creator as hub
 member
    await this.addUserToHub(hubCreator, hub
);

    return hub
;
  }

  async addUserToHub(user: User, hub
: Hub): Promise<void> {
    // Check if user is already a member
    const exists = this.db.prepare(`
      SELECT 1 FROM hub_members 
      WHERE hub_id = ? AND user_id = ?
    `).get(hub
.id, user.id);

    if (exists) return;

    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO hub_members (hub_id, user_id, role, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(hub
.id, user.id, 'member', '{}', now, now);
  }
} 