import { Database } from "bun:sqlite";
import type { SQLQueryBindings } from "bun:sqlite";
import type { BaseModel, BaseRow } from '@models';
import { validateTimestamp } from '@types';
import { TimestampError } from '@platica/shared/src/utils/time';

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

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Get current timestamp in seconds
   */
  protected getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  private serializeRow<D extends object>(data: D): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    // Convert keys to snake_case and handle special fields
    for (const [key, value] of Object.entries(data)) {
      const snakeKey = this.camelToSnake(key);
      
      // Handle JSON fields
      if (this.getJsonFields().includes(key)) {
        result[snakeKey] = JSON.stringify(value);
      }
      // Handle boolean fields
      else if (this.getBooleanFields().includes(key)) {
        result[snakeKey] = value ? 1 : 0;
      }
      // Handle regular fields
      else {
        result[snakeKey] = value;
      }
    }

    return result;
  }

  protected deserializeRow<D extends object>(data: D): T {
    const result: Record<string, unknown> = {};
    
    // Convert keys to camelCase and handle special fields
    for (const [key, value] of Object.entries(data)) {
      const camelKey = this.snakeToCamel(key);
      
      // Handle JSON fields
      if (this.getJsonFields().includes(camelKey) && typeof value === 'string') {
        try {
          result[camelKey] = JSON.parse(value);
        } catch (e) {
          console.warn(`Failed to parse JSON for field ${camelKey}:`, e);
          result[camelKey] = value;
        }
      }
      // Handle boolean fields
      else if (this.getBooleanFields().includes(camelKey)) {
        result[camelKey] = Boolean(value);
      }
      // Handle timestamps
      else if (['createdAt', 'updatedAt', 'deletedAt'].includes(camelKey)) {
        try {
          if (value !== null) {
            result[camelKey] = validateTimestamp(Number(value));
          } else {
            result[camelKey] = null;
          }
        } catch (error) {
          throw new TimestampError(
            `Invalid ${camelKey} in ${this.getTableName()}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      // Handle regular fields
      else {
        result[camelKey] = value;
      }
    }

    return result as T;
  }

  async findById(id: number): Promise<T | undefined> {
    const result = this.db
      .prepare(`SELECT * FROM ${this.getTableName()} WHERE id = ?`)
      .get(id) as BaseRow | null;
    
    return result ? this.deserializeRow(result) : undefined;
  }

  async findAll(): Promise<T[]> {
    const results = this.db
      .prepare(`SELECT * FROM ${this.getTableName()}`)
      .all() as BaseRow[];
    
    return results.map(result => this.deserializeRow(result));
  }

  async create(data: CreateDTO): Promise<T> {
    const now = this.getCurrentTimestamp();
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
    const result = this.db.prepare(query).get(...params) as BaseRow;
    return this.deserializeRow(result);
  }

  async update(id: number, data: UpdateDTO): Promise<T | undefined> {
    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }

    const now = this.getCurrentTimestamp();
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
    const result = this.db.prepare(query).get(...params) as BaseRow | null;
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
} 