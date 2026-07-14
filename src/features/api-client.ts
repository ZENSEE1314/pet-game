import type { ApiResponse, ApiErrorCode } from '@/lib/api';

/**
 * The single fetch wrapper for the whole client.
 *
 * Every route returns the same envelope, so this can unwrap it in one place and
 * throw a typed error — which means no component ever writes `if (!res.ok)` or
 * digs through a JSON body looking for a message.
 */

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};

  const response = await fetch(path, {
    ...rest,
    method: rest.method ?? (json ? 'POST' : 'GET'),
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...rest.headers,
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'The server sent a response we could not read.',
      undefined,
      response.status,
    );
  }

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      payload.error.details,
      response.status,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'POST', json }),
  patch: <T>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'PATCH', json }),
  put: <T>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'PUT', json }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/** Turn any thrown value into something safe to show a human. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
