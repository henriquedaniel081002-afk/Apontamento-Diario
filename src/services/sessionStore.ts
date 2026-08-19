import { User } from '../types';

export const CURRENT_USER_KEY = 'itam_current_user_v2';
export const TOKEN_KEY = 'itam_auth_token_v1';
export const LAST_ACTIVITY_KEY = 'itam_last_activity_v1';
export const SESSION_EXPIRED_EVENT = 'itam:session-expired';
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

export interface SessionExpiredDetail {
  message: string;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredUser(): User | null {
  try {
    const serializedUser = getStorage()?.getItem(CURRENT_USER_KEY);
    if (!serializedUser) return null;

    const user = JSON.parse(serializedUser) as User;
    if (!user.perfil) user.perfil = 'APONTADOR';
    if (!Array.isArray(user.linhas)) user.linhas = [];
    return user;
  } catch {
    return null;
  }
}

export function readStoredToken(): string | null {
  return getStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function readLastActivity(): number | null {
  const rawValue = getStorage()?.getItem(LAST_ACTIVITY_KEY);
  if (!rawValue) return null;

  const timestamp = Number(rawValue);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function markSessionActivity(timestamp = Date.now()): void {
  getStorage()?.setItem(LAST_ACTIVITY_KEY, String(timestamp));
}

export function hasSessionTimedOut(now = Date.now()): boolean {
  const lastActivity = readLastActivity();
  if (lastActivity === null) return true;
  return now - lastActivity >= INACTIVITY_TIMEOUT_MS;
}

export function storeSession(user: User, token: string): void {
  const storage = getStorage();
  storage?.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  storage?.setItem(TOKEN_KEY, token);
  markSessionActivity();
}

export function clearStoredSession(): void {
  const storage = getStorage();
  storage?.removeItem(CURRENT_USER_KEY);
  storage?.removeItem(TOKEN_KEY);
  storage?.removeItem(LAST_ACTIVITY_KEY);
}

export function notifySessionExpired(message = 'Sua sessão expirou. Entre novamente.'): void {
  clearStoredSession();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
        detail: { message },
      }),
    );
  }
}

export function subscribeToSessionExpired(
  listener: (detail: SessionExpiredDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleExpired = (event: Event) => {
    listener((event as CustomEvent<SessionExpiredDetail>).detail);
  };

  window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
}
