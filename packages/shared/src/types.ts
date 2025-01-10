// Base Types
import { TIMESTAMP_BOUNDS } from './utils/time';

/**
 * UnixTimestamp represents a Unix timestamp in seconds since epoch
 * Must be between Jan 1, 2000 and Jan 1, 3000
 */
export type UnixTimestamp = number;

/**
 * Type guard to validate a UnixTimestamp at compile time
 */
export function isUnixTimestamp(value: number): value is UnixTimestamp {
  return value >= TIMESTAMP_BOUNDS.MIN && value <= TIMESTAMP_BOUNDS.MAX;
}

/**
 * Branded type for compile-time validation of Unix timestamps
 */
export type ValidatedUnixTimestamp = number & { __brand: 'ValidatedUnixTimestamp' };

/**
 * Convert a number to a validated timestamp, throwing if invalid
 */
export function validateTimestamp(value: number): ValidatedUnixTimestamp {
  if (!isUnixTimestamp(value)) {
    throw new Error(`Invalid Unix timestamp: ${value}`);
  }
  return value as ValidatedUnixTimestamp;
}