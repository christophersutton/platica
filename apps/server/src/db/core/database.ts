import { Database } from "bun:sqlite";
import { join } from "path";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Singleton database service that manages connections and prepared statements
 * for both read and write operations.
 */
export class DatabaseService {
  private static writeInstance: DatabaseService | null = null;
  private static readInstances: Map<string, DatabaseService> = new Map();
  
  private readonly statements: Map<string, any> = new Map();
  private readonly cache: Map<string, CacheEntry<any>> = new Map();

  private constructor(
    private readonly isReadOnly: boolean = false,
    private readonly serviceId: string = 'default'
  ) {
    const dbPath = join(import.meta.dir, "../../../data/db.sqlite");
    console.log('Opening database at:', dbPath);
    
    this.db = new Database(dbPath, { 
        readonly: isReadOnly,
        create: true,
        readwrite: !isReadOnly
    });
    
    if (!isReadOnly) {
      // Optimize for write performance with WAL mode
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA cache_size = -64000;
        PRAGMA temp_store = MEMORY;
      `);
    } else {
      // Optimize read-only connections
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA cache_size = -32000;
        PRAGMA temp_store = MEMORY;
        PRAGMA read_uncommitted = 1;
      `);
    }

    // Prepare common statements once
    this.prepareStatements();
  }

  // Expose the underlying database for compatibility
  public readonly db: Database;

  // Proxy database methods
  public prepare(...args: Parameters<Database['prepare']>) {
    return this.db.prepare(...args);
  }

  public query(...args: Parameters<Database['query']>) {
    return this.db.query(...args);
  }

  public exec(...args: Parameters<Database['exec']>) {
    if (this.isReadOnly) {
      throw new Error('Cannot execute write operations on read-only connection');
    }
    return this.db.exec(...args);
  }

  public run(...args: Parameters<Database['run']>) {
    if (this.isReadOnly) {
      throw new Error('Cannot execute write operations on read-only connection');
    }
    return this.db.run(...args);
  }

  public transaction<T>(cb: () => T): T {
    if (this.isReadOnly) {
      throw new Error('Cannot execute transactions on read-only connection');
    }
    return this.db.transaction(cb)();
  }

  /**
   * Get the singleton write instance
   */
  public static getWriteInstance(): DatabaseService {
    if (!DatabaseService.writeInstance) {
      DatabaseService.writeInstance = new DatabaseService(false);
    }
    return DatabaseService.writeInstance;
  }

  /**
   * Get a read-only instance for a specific service
   */
  public static getReadInstance(serviceId: string): DatabaseService {
    if (!DatabaseService.readInstances.has(serviceId)) {
      DatabaseService.readInstances.set(
        serviceId,
        new DatabaseService(true, serviceId)
      );
    }
    return DatabaseService.readInstances.get(serviceId)!;
  }

  private prepareStatements() {
    // Write statements (only for write service)
    if (!this.isReadOnly) {
      this.statements.set(
        'insertMessage',
        this.db.prepare(`
          INSERT INTO messages (id, hub_id, workspace_id, sender_id, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
      );

      this.statements.set(
        'updateMessage',
        this.db.prepare(`
          UPDATE messages 
          SET content = ?, is_edited = true, edited_at = ?
          WHERE id = ? AND sender_id = ?
        `)
      );
    }

    // Read statements (for all services)
    this.statements.set(
      'getHubMessages',
      this.db.prepare(`
        SELECT m.*, u.name as user_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.hub_id = ?
        AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT ?
      `)
    );

    this.statements.set(
      'getThreadMessages',
      this.db.prepare(`
        SELECT m.*, u.name as user_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.thread_id = ?
        AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
      `)
    );
  }

  /**
   * Get a prepared statement by name
   */
  protected getStatement(name: string) {
    const stmt = this.statements.get(name);
    if (!stmt) {
      throw new Error(`Prepared statement '${name}' not found`);
    }
    return stmt;
  }

  /**
   * Cache management methods
   */
  protected getCached<T>(key: string, ttlMs: number = 30000): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttlMs) {
      return entry.data as T;
    }
    return null;
  }

  protected setCache<T>(key: string, data: T) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  protected clearCache() {
    this.cache.clear();
  }

  /**
   * Close the database connection
   */
  public close() {
    this.db.close();
  }
} 