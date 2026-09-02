import { apiRequest } from './apiClient';

export interface ControleFaltasRegistro {
  id: string;
  apontamentoId: string;
  data: string;
  setor: string;
  linha?: string;
  turno?: string;
  quantidade: number;
  nome: string;
  motivoJustificativa: string;
  atestado: boolean;
}

export interface ControleFaltasResponse {
  geradoEm: string;
  registros: ControleFaltasRegistro[];
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; data: ControleFaltasResponse }>();
const pending = new Map<string, Promise<ControleFaltasResponse>>();

function cacheKey(dataInicio: string, dataFim: string) {
  return `${dataInicio}|${dataFim}`;
}

export const controleFaltasService = {
  async getData(dataInicio: string, dataFim: string, forceRefresh = false): Promise<ControleFaltasResponse> {
    const key = cacheKey(dataInicio, dataFim);
    const cached = cache.get(key);
    if (!forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

    const currentRequest = pending.get(key);
    if (!forceRefresh && currentRequest) return currentRequest;

    const params = new URLSearchParams({ dataInicio, dataFim });
    const request = apiRequest<ControleFaltasResponse>(`/api/coordenacao/controle-faltas?${params.toString()}`, {
      cache: 'no-store',
    })
      .then((data) => {
        cache.set(key, { at: Date.now(), data });
        return data;
      })
      .finally(() => pending.delete(key));

    pending.set(key, request);
    return request;
  },

  invalidate() {
    cache.clear();
    pending.clear();
  },
};
