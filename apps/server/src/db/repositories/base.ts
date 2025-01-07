import { Database } from "bun:sqlite";
import type { SQLQueryBindings } from "bun:sqlite";
import type { BaseModel } from '@platica/shared';

export interface DatabaseProvider {
  db: Database;
}

/**
 * Base repository class that provides CRUD operations for database entities
 * @template T The model type that extends BaseModel
 * @template CreateDTO Type for create operation, defaults to omitting auto-generated fields
 * @template UpdateDTO Type for update operation, defaults to partial of CreateDTO
 */
export abstract class BaseRepository<
  T extends BaseModel,
  CreateDTO extends object = Omit<T, keyof BaseModel>,
  UpdateDTO extends object = Partial<CreateDTO>
> {
  protected readonly db: Database;

  constructor(dbProvider: Database | DatabaseProvider) {
    this.db = 'db' in dbProvider ? dbProvider.db : dbProvider;
  }

  abstract getTableName(): string;

  /**
   * Override this to specify which fields should be serialized as JSON
   */
  protected getJsonFields(): string[] {
    return [];
  }

  /**
   * Override this to specify which fields should be treated as booleans
   */
  protected getBooleanFields(): string[] {
    return [];
  }

  async findById(id: number): Promise<T | undefined> {
    const result = this.db
      .prepare(`SELECT * FROM ${this.getTableName()} WHERE id = ?`)
      .get(id) as T | null;
    
    return result ? this.deserializeRow(result) : undefined;
  }

  async findAll(): Promise<T[]> {
    const results = this.db
      .prepare(`SELECT * FROM ${this.getTableName()}`)
      .all() as T[];
    
    return results.map(result => this.deserializeRow(result));
  }

  async create(data: CreateDTO): Promise<T> {
    const now = Math.floor(Date.now() / 1000);
    const serializedData = this.serializeRow(data);
    const fields = Object.keys(serializedData);
    const values = Object.values(serializedData) as SQLQueryBindings[];
    
    const query = `
      INSERT INTO ${this.getTableName()} (
        ${fields.join(', ')},
        created_at,
        updated_at
      ) VALUES (
        ${fields.map(() => '?').join(', ')},
        ?,
        ?
      ) RETURNING *
    `;

    const params: SQLQueryBindings[] = [...values, now, now];
    const result = this.db.prepare(query).get(...params) as T;
    return this.deserializeRow(result);
  }

  async update(id: number, data: UpdateDTO): Promise<T | undefined> {
    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }

    const now = Math.floor(Date.now() / 1000);
    const serializedData = this.serializeRow(data);
    const fields = Object.keys(serializedData);
    const values = Object.values(serializedData) as SQLQueryBindings[];
    
    const query = `
      UPDATE ${this.getTableName()}
      SET ${fields.map(field => `${field} = ?`).join(', ')},
          updated_at = ?
      WHERE id = ?
      RETURNING *
    `;

    const params: SQLQueryBindings[] = [...values, now, id];
    const result = this.db.prepare(query).get(...params) as T | null;
    return result ? this.deserializeRow(result) : undefined;
  }

  async delete(id: number): Promise<void> {
    await this.db
      .prepare(`DELETE FROM ${this.getTableName()} WHERE id = ?`)
      .run(id);
  }

  protected async transaction<R>(fn: () => Promise<R> | R): Promise<R> {
    this.db.exec('BEGIN TRANSACTION');
    try {
      const result = await fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private serializeRow<D extends object>(data: D): D {
    const result = { ...data };
    
    // Handle JSON fields
    const jsonFields = this.getJsonFields();
    for (const field of jsonFields) {
      if (field in result) {
        (result as any)[field] = JSON.stringify((result as any)[field]);
      }
    }

    // Handle boolean fields
    const booleanFields = this.getBooleanFields();
    for (const field of booleanFields) {
      if (field in result) {
        (result as any)[field] = (result as any)[field] ? 1 : 0;
      }
    }

    return result;
  }

  protected deserializeRow<D extends object>(data: D): D {
    const result = { ...data };
    
    // Handle JSON fields
    const jsonFields = this.getJsonFields();
    for (const field of jsonFields) {
      if (field in result && typeof (result as any)[field] === 'string') {
        try {
          (result as any)[field] = JSON.parse((result as any)[field]);
        } catch (e) {
          // If JSON parsing fails, leave as is
          console.warn(`Failed to parse JSON for field ${field}:`, e);
        }
      }
    }

    // Handle boolean fields
    const booleanFields = this.getBooleanFields();
    for (const field of booleanFields) {
      if (field in result) {
        (result as any)[field] = Boolean((result as any)[field]);
      }
    }

    return result;
  }
} 