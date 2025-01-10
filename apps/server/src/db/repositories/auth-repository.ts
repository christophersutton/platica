import { Database } from "bun:sqlite";
import { BaseRepository } from "./base";
import type { User } from '@models/user';
import type { AuthToken, AuthTokenRow, UserCreateDTO, UserUpdateDTO } from '@models/auth';

export class AuthRepository extends BaseRepository<User, UserCreateDTO, UserUpdateDTO> {
  constructor(db: Database) {
    super(db);
  }

  getTableName(): string {
    return 'users';
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as User | undefined;
  }

  async findOrCreate(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (user) return user;

    return this.create({
      email,
      name: email.split('@')[0],
      avatarUrl: null
    });
  }

  async createAuthToken(data: { userId: number; expiresAt: number }): Promise<string> {
    const token = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    this.db.prepare(`
      INSERT INTO auth_tokens (token, user_id, expires_at, used, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(token, data.userId, data.expiresAt, now, now);

    return token;
  }

  async verifyAndConsumeToken(token: string): Promise<AuthToken | undefined> {
    return this.transaction(async () => {
      // Get and verify token
      const now = Math.floor(Date.now() / 1000);
      const row = this.db.prepare(`
        SELECT * FROM auth_tokens
        WHERE token = ?
        AND used = 0
        AND expires_at > ?
      `).get(token, now) as AuthTokenRow | undefined;

      if (!row) return undefined;

      // Mark token as used
      this.db.prepare(`
        UPDATE auth_tokens
        SET used = 1, updated_at = ?
        WHERE token = ?
      `).run(now, token);

      // Convert row to domain type
      return {
        id: row.id,
        token: row.token,
        userId: row.user_id,
        expiresAt: row.expires_at,
        used: Boolean(row.used),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  async deleteExpiredTokens(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      DELETE FROM auth_tokens
      WHERE expires_at < ?
    `).run(now);
  }
} 