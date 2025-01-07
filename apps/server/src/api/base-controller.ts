import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: 200 | 201 | 400 | 401 | 403 | 404 | 500 = 400,
    public readonly meta?: Record<string, unknown>
  ) {
    super(message);
  }
}

export abstract class BaseController {
  protected success<T>(c: Context, data: T, meta?: Record<string, unknown>, status: 200 | 201 = 200): Response {
    return c.json({ data, meta }, status);
  }

  protected error(c: Context, error: Error | ApiError | HTTPException): Response {
    if (error instanceof ApiError) {
      return c.json(
        { error: error.message, meta: error.meta },
        error.statusCode
      );
    }

    if (error instanceof HTTPException) {
      return c.json(
        { error: error.message },
        error.status
      );
    }

    console.error('Unhandled error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }

  protected async handle<T>(
    c: Context,
    fn: () => Promise<T>
  ): Promise<Response> {
    try {
      const data = await fn();
      return this.success(c, data);
    } catch (err) {
      return this.error(c, err as Error);
    }
  }

  protected requireUser(c: Context): { userId: number; email: string } {
    const user = c.get('user');
    if (!user) {
      throw new ApiError('Unauthorized', 401);
    }
    return user;
  }

  protected requireParam(c: Context, param: string): string {
    const value = c.req.param(param);
    if (!value) {
      throw new ApiError(`Missing required parameter: ${param}`, 400);
    }
    return value;
  }

  protected requireNumberParam(c: Context, param: string): number {
    const value = Number(this.requireParam(c, param));
    if (isNaN(value)) {
      throw new ApiError(`Invalid number parameter: ${param}`, 400);
    }
    return value;
  }

  protected async requireBody<T>(c: Context): Promise<T> {
    try {
      return await c.req.json() as T;
    } catch (err) {
      throw new ApiError('Invalid request body', 400);
    }
  }

  protected requireQuery(c: Context, param: string): string {
    const value = c.req.query(param);
    if (!value) {
      throw new ApiError(`Missing required query parameter: ${param}`, 400);
    }
    return value;
  }

  protected requireNumberQuery(c: Context, param: string): number {
    const value = Number(this.requireQuery(c, param));
    if (isNaN(value)) {
      throw new ApiError(`Invalid number query parameter: ${param}`, 400);
    }
    return value;
  }
} 