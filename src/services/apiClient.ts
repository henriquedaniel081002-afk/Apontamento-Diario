import { notifySessionExpired, readStoredToken } from './sessionStore';

interface ApiRequestOptions {
  requiresAuth?: boolean;
}

interface ErrorPayload {
  error?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as ErrorPayload).error === 'string'
  ) {
    return (payload as ErrorPayload).error || fallback;
  }

  return fallback;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return undefined;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  { requiresAuth = true }: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (requiresAuth) {
    const token = readStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  const payload = await readResponseBody(response);

  if (response.status === 401 && requiresAuth) {
    const message = 'Sua sessão expirou. Entre novamente.';
    notifySessionExpired(message);
    throw new ApiError(message, response.status, payload);
  }

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, 'Erro na comunicação com o servidor.'),
      response.status,
      payload,
    );
  }

  return payload as T;
}
