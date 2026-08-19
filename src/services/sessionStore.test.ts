import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../types';
import {
  CURRENT_USER_KEY,
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_KEY,
  TOKEN_KEY,
  clearStoredSession,
  hasSessionTimedOut,
  markSessionActivity,
  readLastActivity,
  storeSession,
} from './sessionStore';

const mockUser: User = {
  id: '1',
  name: 'SOLDA',
  setor: 'SOLDA',
  perfil: 'APONTADOR',
  linhas: ['MON', 'TRI'],
};

describe('sessionStore - inatividade', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('registra a atividade ao criar a sessão', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    storeSession(mockUser, 'token');

    expect(window.localStorage.getItem(CURRENT_USER_KEY)).toBeTruthy();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('token');
    expect(readLastActivity()).toBe(1_000_000);
  });

  it('considera a sessão expirada após uma hora sem atividade', () => {
    markSessionActivity(1_000_000);

    expect(hasSessionTimedOut(1_000_000 + INACTIVITY_TIMEOUT_MS - 1)).toBe(false);
    expect(hasSessionTimedOut(1_000_000 + INACTIVITY_TIMEOUT_MS)).toBe(true);
  });

  it('considera sessão antiga sem registro de atividade como expirada', () => {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(mockUser));
    window.localStorage.setItem(TOKEN_KEY, 'token-antigo');

    expect(hasSessionTimedOut()).toBe(true);
  });

  it('remove também o registro de atividade ao encerrar a sessão', () => {
    storeSession(mockUser, 'token');
    clearStoredSession();

    expect(window.localStorage.getItem(CURRENT_USER_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
  });
});
