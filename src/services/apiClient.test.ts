import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { apiRequest } from './apiClient';
import {
  CURRENT_USER_KEY,
  SESSION_EXPIRED_EVENT,
  TOKEN_KEY,
  storeSession,
} from './sessionStore';

const mockUser: User = {
  id: 'mock-user',
  name: 'Bobinagem',
  perfil: 'APONTADOR',
  setor: 'BOBINA AT/BT',
  linhas: ['MON', 'TRI'],
};

describe('cliente HTTP e sessão', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('preserva o Bearer token nos endpoints protegidos', async () => {
    storeSession(mockUser, 'token-ficticio');
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ ok: boolean }>('/api/health')).resolves.toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-ficticio');
  });

  it('limpa a sessão e notifica a aplicação quando um endpoint protegido retorna 401', async () => {
    storeSession(mockUser, 'token-expirado');
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Inválido' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(apiRequest('/api/apontamentos')).rejects.toMatchObject({
      status: 401,
      message: 'Sua sessão expirou. Entre novamente.',
    });
    expect(localStorage.getItem(CURRENT_USER_KEY)).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('não trata credencial inválida no login como expiração de sessão', async () => {
    storeSession(mockUser, 'token-anterior');
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'Usuário ou senha incorretos.',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(apiRequest('/api/auth/login', {}, { requiresAuth: false })).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: 'Usuário ou senha incorretos.',
      }),
    );
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-anterior');
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
