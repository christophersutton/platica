import type { UnixTimestamp } from '../../types';

/**
 * Base model interface that all database models extend
 */
export interface BaseModel {
    id: number;
    created_at: UnixTimestamp;
    updated_at: UnixTimestamp;
}

/**
 * Base model interface for soft-deletable entities
 */
export interface SoftDeletableModel extends BaseModel {
    deleted_at: UnixTimestamp | null;
}

/**
 * Base model interface for entities with optimistic locking
 */
export interface VersionedModel extends BaseModel {
    version: number;
} 