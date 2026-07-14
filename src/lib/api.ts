import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * One response envelope for the whole API surface, so a native client (or the
 * web client) only ever has to write one error-handling path.
 */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: ApiErrorCode; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'SUSPENDED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'COOLDOWN_ACTIVE'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_ENERGY'
  | 'OUT_OF_STOCK'
  | 'LIMIT_REACHED'
  | 'RATE_LIMITED'
  | 'INVALID_SESSION'
  | 'INVALID_TOKEN'
  | 'ALREADY_CLAIMED'
  | 'EXPIRED'
  | 'PET_SICK'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  SUSPENDED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  COOLDOWN_ACTIVE: 429,
  INSUFFICIENT_FUNDS: 400,
  INSUFFICIENT_ENERGY: 400,
  OUT_OF_STOCK: 409,
  LIMIT_REACHED: 409,
  RATE_LIMITED: 429,
  INVALID_SESSION: 400,
  INVALID_TOKEN: 400,
  ALREADY_CLAIMED: 409,
  EXPIRED: 410,
  PET_SICK: 409,
  INTERNAL_ERROR: 500,
};

/** The one error type services throw. Route handlers turn it into a response. */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status: STATUS_BY_CODE[code] },
  );
}

/**
 * Wrap a route handler so every thrown error becomes a consistent envelope and
 * an unexpected exception never leaks a stack trace to the client.
 */
export function handleApiError(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return fail('VALIDATION_ERROR', 'The submitted data is invalid.', error.flatten().fieldErrors);
  }

  console.error('[api] unhandled error:', error);
  return fail('INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

/**
 * Wraps a route handler's body so every throw becomes a consistent error envelope.
 *
 * The return type is intentionally the loose `NextResponse` rather than a generic
 * `NextResponse<ApiResponse<T>>`: a handler that returns `ok({ pet: null })` on one
 * branch and `ok({ pet: {...} })` on another has two different success shapes, and a
 * single inferred `T` would reject the second branch. The response *shape* is already
 * guaranteed by `ok()` and `fail()` — this wrapper only needs to guarantee that
 * nothing escapes uncaught.
 */
export async function withApi(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleApiError(error);
  }
}
