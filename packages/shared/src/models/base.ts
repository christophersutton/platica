import type { UnixTimestamp, ValidatedUnixTimestamp } from '@types';

/**
 * Base model interface that all domain models extend
 * Uses ValidatedUnixTimestamp to ensure timestamps are valid at compile time
 */
export interface BaseModel {
    id: number;
    createdAt: ValidatedUnixTimestamp;
    updatedAt: ValidatedUnixTimestamp;
}

/**
 * Base model interface for soft-deletable entities
 */
export interface SoftDeletableModel extends BaseModel {
    deletedAt: ValidatedUnixTimestamp | null;
}

/**
 * Base model interface for entities with optimistic locking
 */
export interface VersionedModel extends BaseModel {
    version: number;
}

/**
 * Base database row interface that all database models extend
 * Uses raw UnixTimestamp as database values need validation before use
 */
export interface BaseRow {
    id: number;
    created_at: UnixTimestamp;
    updated_at: UnixTimestamp;
}

/**
 * Base database row interface for soft-deletable entities
 */
export interface SoftDeletableRow extends BaseRow {
    deleted_at: UnixTimestamp | null;
}

/**
 * Base database row interface for entities with optimistic locking
 */
export interface VersionedRow extends BaseRow {
    version: number;
} 