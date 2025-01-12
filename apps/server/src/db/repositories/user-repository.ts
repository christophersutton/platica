import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { User } from "@models/user";
import type { AuthToken, AuthTokenRow, UserCreateDTO, UserUpdateDTO } from "@models/auth";
import { WorkspaceRepository } from "./workspace-repository";
import { UserRole } from "@constants/enums";
import { validateTimestamp } from "@types";

/**
 * UserRepository: manages user records and auth tokens in the DB.
 */
export class UserRepository extends BaseRepository<User, UserCreateDTO, UserUpdateDTO> {
  private workspaceRepo: WorkspaceRepository;

  constructor(db: Database) {
    super(db);
    this.workspaceRepo = new WorkspaceRepository(db);
  }

  getTableName(): string {
    return "users";
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as User | undefined;
    return row ? this.deserializeRow(row) : undefined;
  }

  async findOrCreate(email: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    return this.createNewUserWithWorkspace(email);
  }

  private async createNewUserWithWorkspace(email: string): Promise<User> {
    console.log("Creating new user with workspace for:", email);
    return this.transaction(async () => {
      const user = await this.create({
        email,
        name: email.split("@")[0],
        avatarUrl: null,
      });
      console.log("User created:", user.id);

      // Create personal workspace
      const workspaceName = `${user.name}'s Workspace`;
      const workspaceSlug = `${user.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-${user.id}`;

      const workspace = await this.workspaceRepo.create({
        name: workspaceName,
        slug: workspaceSlug,
        ownerId: user.id,
        settings: {},
      });
      console.log("Workspace created:", workspace.id);

      // Add user as admin
      await this.workspaceRepo.addUser(workspace.id, user.id, UserRole.ADMIN);
      console.log("User added as admin to workspace");

      return user;
    });
  }

  async createAuthToken(data: { userId: number; expiresAt: number }): Promise<string> {
    const token = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    this.db
      .prepare(
        `INSERT INTO auth_tokens (token, user_id, expires_at, used, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`
      )
      .run(token, data.userId, data.expiresAt, now, now);

    return token;
  }

  async verifyAndConsumeToken(token: string): Promise<AuthToken | undefined> {
    return this.transaction(() => {
      const now = Math.floor(Date.now() / 1000);
      const row = this.db
        .prepare(
          `SELECT * FROM auth_tokens
           WHERE token = ?
             AND used = 0
             AND expires_at > ?`
        )
        .get(token, now) as AuthTokenRow | undefined;
      if (!row) return undefined;

      // Mark token as used
      this.db
        .prepare(
          `UPDATE auth_tokens
           SET used = 1, updated_at = ?
           WHERE token = ?`
        )
        .run(now, token);

      return {
        id: row.id,
        token: row.token,
        userId: row.user_id,
        expiresAt: row.expires_at,
        used: Boolean(row.used),
        createdAt: validateTimestamp(row.created_at),
        updatedAt: validateTimestamp(row.updated_at),
      };
    });
  }

  async deleteExpiredTokens(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(`DELETE FROM auth_tokens WHERE expires_at < ?`)
      .run(now);
  }
}