import type { Context, Next } from 'hono';
import { Database } from 'bun:sqlite';
import { DatabaseService } from '../db/database';
import { getCurrentUnixTimestamp, unixTimestampToMilliseconds } from '../utils/time';

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  max: number;         // Max requests per window
  keyGenerator?: (c: Context) => string;  // Custom key generator
}

interface RateLimitRecord {
  key: string;
  requests: number;
  window_start: number;  // Unix timestamp in seconds
}

export const rateLimit = (db: Database | DatabaseService, config: RateLimitConfig) => {
  const database = db instanceof DatabaseService ? db.db : db;
  const TABLE_NAME = 'rate_limits';
  
  // Create rate limit table if it doesn't exist
  database.run(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      key TEXT PRIMARY KEY,
      requests INTEGER NOT NULL,
      window_start INTEGER NOT NULL  -- Unix timestamp in seconds
    )
  `);

  // Default key generator uses IP address
  const defaultKeyGenerator = (c: Context) => {
    return c.req.header('x-forwarded-for') || 
           c.req.header('x-real-ip') || 
           'unknown';
  };

  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  const { windowMs, max } = config;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = getCurrentUnixTimestamp();
    const windowStartMs = unixTimestampToMilliseconds(now) - (unixTimestampToMilliseconds(now) % windowMs);
    const windowStart = Math.floor(windowStartMs / 1000);

    // Use a transaction to ensure atomic updates
    const result = database.transaction(() => {
      // Clean up old records
      database.prepare(`
        DELETE FROM ${TABLE_NAME}
        WHERE window_start < ?
      `).run(windowStart);

      // Get or create rate limit record
      let record = database.prepare(`
        SELECT * FROM ${TABLE_NAME}
        WHERE key = ? AND window_start = ?
      `).get(key, windowStart) as RateLimitRecord | undefined;

      if (!record) {
        database.prepare(`
          INSERT INTO ${TABLE_NAME} (key, requests, window_start)
          VALUES (?, 1, ?)
        `).run(key, windowStart);
        record = { key, requests: 1, window_start: windowStart };
      } else {
        database.prepare(`
          UPDATE ${TABLE_NAME}
          SET requests = requests + 1
          WHERE key = ? AND window_start = ?
        `).run(key, windowStart);
        record.requests++;
      }

      return record;
    })();

    // Set rate limit headers
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, max - result.requests).toString());
    c.header('X-RateLimit-Reset', unixTimestampToMilliseconds(windowStart + Math.floor(windowMs / 1000)).toString());

    if (result.requests > max) {
      return c.json(
        { error: 'Too many requests, please try again later.' },
        429,
        { 'Retry-After': String(windowStart + Math.floor(windowMs / 1000) - now) }
      );
    }

    return next();
  };
};

// Example usage:
// const app = new Hono();
// app.use('/*', rateLimit(db, {
//   windowMs: 15 * 60 * 1000,  // 15 minutes
//   max: 100                    // limit each IP to 100 requests per windowMs
// }));