import { User } from '../types';
import { MOCK_USERS } from '../mocks/mockData';
import { ApiError, apiRequest } from './apiClient';
import {
  clearStoredSession,
  readStoredToken,
  readStoredUser,
  storeSession,
  subscribeToSessionExpired,
} from './sessionStore';

interface LoginResponse {
  user: User;
  token: string;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  getUsers(): User[] {
    return MOCK_USERS;
  },

  getCurrentUser(): User | null {
    return readStoredUser();
  },

  async login(userId: string, passwordAttempt: string): Promise<LoginResult> {
    const selectedUser = MOCK_USERS.find((user) => user.id === userId);
    if (!selectedUser) return { success: false, error: 'Usuário não encontrado.' };

    try {
      // O nome exibido na interface pode ser diferente do login cadastrado no Neon.
      // Montagem do Núcleo e Corte do Núcleo compartilham o usuário "Montagem Nucleo".
      const login = selectedUser.id === 'usr-montagem-nucleo' ? 'Montagem Nucleo' : selectedUser.name;

      const response = await apiRequest<LoginResponse>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            login,
            password: passwordAttempt,
          }),
        },
        { requiresAuth: false },
      );

      if (!response?.user || !response.token) {
        return { success: false, error: 'Resposta de autenticação inválida.' };
      }

      storeSession(response.user, response.token);
      return { success: true, user: response.user };
    } catch (error) {
      if (error instanceof ApiError) {
        return { success: false, error: error.message };
      }

      return { success: false, error: 'Não foi possível conectar ao servidor.' };
    }
  },

  logout(): void {
    clearStoredSession();
  },

  getToken(): string | null {
    return readStoredToken();
  },

  onSessionExpired: subscribeToSessionExpired,
};
