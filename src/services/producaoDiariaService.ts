import type { DailyProductionResponse } from '../producao-diaria/types';
import type { DailyProductionObservation, DailyObservationLine } from '../producao-diaria/observacoes';
import type { ActionFields, ActionFilters, ActionHistoryPage, ActionPage, DailyAction } from '../producao-diaria/acoes';
import { apiRequest } from './apiClient';

const route = '/api/coordenacao/producao-diaria';

export const producaoDiariaService = {
  getData(dataInicio: string, dataFim: string, linha = 'ALL'): Promise<DailyProductionResponse> {
    const params = new URLSearchParams({ dataInicio, dataFim, linha });
    return apiRequest<DailyProductionResponse>(`${route}?${params}`, { cache: 'no-store' });
  },
  async getObservacoes(dataInicio: string, dataFim: string): Promise<DailyProductionObservation[]> {
    const params = new URLSearchParams({ dataInicio, dataFim });
    const response = await apiRequest<{ observacoes: DailyProductionObservation[] }>(
      `${route}/observacoes?${params}`, { cache: 'no-store' },
    );
    return response.observacoes;
  },
  async saveObservacao(
    data: string, setor: string, linha: DailyObservationLine, observacao: string, versao?: number | null,
  ): Promise<DailyProductionObservation> {
    const response = await apiRequest<{ observacao: DailyProductionObservation }>(
      `${route}/observacoes`,
      { method: 'PUT', body: JSON.stringify({ data, setor, linha, observacao, versao }) },
      { globalLoading: false },
    );
    return response.observacao;
  },
  getAcoes(filters: ActionFilters): Promise<ActionPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return apiRequest<ActionPage>(`${route}/acoes?${params}`, { cache: 'no-store' });
  },
  async createAcao(payload: ActionFields & { data_origem: string; chave_requisicao: string }): Promise<DailyAction> {
    const response = await apiRequest<{ acao: DailyAction }>(
      `${route}/acoes`, { method: 'POST', body: JSON.stringify(payload) }, { globalLoading: false },
    );
    return response.acao;
  },
  async getAcao(id: string): Promise<DailyAction> {
    const response = await apiRequest<{ acao: DailyAction }>(`${route}/acoes/${id}`, { cache: 'no-store' });
    return response.acao;
  },
  async updateAcao(id: string, payload: Partial<ActionFields> & { versao: number }): Promise<DailyAction> {
    const response = await apiRequest<{ acao: DailyAction }>(
      `${route}/acoes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, { globalLoading: false },
    );
    return response.acao;
  },
  async deleteAcao(id: string, versao: number): Promise<void> {
    await apiRequest<void>(
      `${route}/acoes/${id}`, { method: 'DELETE', body: JSON.stringify({ versao }) }, { globalLoading: false },
    );
  },
  getAcaoHistorico(id: string, cursor?: string): Promise<ActionHistoryPage> {
    const params = new URLSearchParams(cursor ? { cursor } : {});
    return apiRequest<ActionHistoryPage>(`${route}/acoes/${id}/historico?${params}`, { cache: 'no-store' });
  },
};
