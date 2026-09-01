import { notifySessionExpired, readStoredToken } from './sessionStore';
import { finishLoadingProgress, startLoadingProgress } from './loadingProgressService';

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


function loadingCopy(path: string, method = 'GET'): { label: string; description: string } {
  const verb = method.toUpperCase();
  if (path.includes('/api/auth/login')) {
    return { label: 'Autenticando acesso', description: 'Validando usuário, senha e permissões do perfil selecionado.' };
  }
  if (path.includes('/importar-producao')) {
    return { label: 'Importando produção', description: 'Enviando a produção do Excel e atualizando os registros no Neon.' };
  }
  if (path.includes('/importar-programacao')) {
    return { label: 'Importando programação', description: 'Substituindo a programação do mês com segurança.' };
  }
  if (path.includes('/excluir-apontamentos')) {
    return { label: 'Excluindo apontamentos', description: 'Removendo somente os registros que correspondem ao recorte selecionado.' };
  }
  if (path.includes('/dashboard')) {
    return { label: 'Carregando dashboard', description: 'Buscando programação, produção e ocorrências para montar os indicadores.' };
  }
  if (verb === 'DELETE') {
    return { label: 'Excluindo registro', description: 'Aplicando a exclusão e atualizando os dados do sistema.' };
  }
  if (verb === 'PATCH' && path.includes('/aprovacao')) {
    return { label: 'Atualizando aprovação', description: 'Salvando o novo status de aprovação do apontamento.' };
  }
  if (verb === 'PUT' || verb === 'POST' || verb === 'PATCH') {
    return { label: 'Salvando alterações', description: 'Gravando as informações e aguardando a confirmação do servidor.' };
  }
  return { label: 'Carregando dados', description: 'Buscando as informações mais recentes do sistema.' };
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

  const copy = loadingCopy(path, init.method || 'GET');
  const loadingId = startLoadingProgress(copy.label, copy.description);

  try {
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
  } finally {
    finishLoadingProgress(loadingId);
  }
}
