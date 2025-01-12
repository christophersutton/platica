import type { UnixTimestamp } from '@types'
import type { BaseModel } from '@models/base'
import type { User } from '@models/user'

/**
 * Core AuthToken domain type
 */
export interface AuthToken extends BaseModel {
  token: string
  userId: User['id']
  expiresAt: UnixTimestamp
  used: boolean
  workspaceId?: number
}

/**
 * Database row type
 */
export interface AuthTokenRow {
  id: number
  token: string
  user_id: User['id']
  expires_at: UnixTimestamp
  used: boolean
  workspace_id?: number
  created_at: UnixTimestamp
  updated_at: UnixTimestamp
}

/**
 * JWT payload type - must be compatible with Hono's JWTPayload
 */
export interface JwtPayload {
  id: User['id']
  email: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

/**
 * User creation DTO
 */
export type UserCreateDTO = Pick<User, 'email' | 'name' | 'avatarUrl'>

/**
 * User update DTO
 */
export type UserUpdateDTO = Partial<UserCreateDTO>

/**
 * Magic link request DTO
 */
export interface MagicLinkRequestDTO {
  email: string
  workspaceId?: string
}

/**
 * Magic link verification DTO
 */
export interface MagicLinkVerifyDTO {
  token: string
}

/**
 * Auth response type
 */
export interface AuthResponse {
  token: string
  user: User
}

/**
 * Auth state type for client context
 */
export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isInitialized: boolean
  error: Error | null
}

/**
 * Auth action type for client reducer
 */
export type AuthAction =
  | { type: 'INIT' }
  | { type: 'SET_USER'; payload: AuthResponse }
  | { type: 'CLEAR_USER' }
  | { type: 'ERROR'; payload: Error } 