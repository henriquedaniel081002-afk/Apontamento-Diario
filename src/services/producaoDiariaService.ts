import type { DailyProductionResponse } from '../producao-diaria/types';
import type { DailyProductionObservation, DailyObservationLine } from '../producao-diaria/observacoes';
import { apiRequest } from './apiClient';

export const producaoDiariaService = {
  getData(dataInicio: string, dataFim: string, linha = 'ALL'): Promise<DailyProductionResponse> {
    const params = new URLSearchParams({ dataInicio, dataFim, linha });
    return apiRequest<DailyProductionResponse>(
      `/api/coordenacao/producao-diaria?${params.toString()}`,
      { cache: 'no-store' },
    );
  },
  async getObservacoes(dataInicio: string, dataFim: string): Promise<DailyProductionObservation[]> {
    const params = new URLSearchParams({ dataInicio, dataFim });
    const response = await apiRequest<{ observacoes: DailyProductionObservation[] }>(
      `/api/coordenacao/producao-diaria/observacoes?${params.toString()}`,
      { cache: 'no-store' },
    );
    return response.observacoes;
  },
  async saveObservacao(data: string, setor: string, linha: DailyObservationLine, observacao: string): Promise<DailyProductionObservation> {
    const response = await apiRequest<{ observacao: DailyProductionObservation }>(
      '/api/coordenacao/producao-diaria/observacoes',
      { method: 'PUT', body: JSON.stringify({ data, setor, linha, observacao }) },
    );
    return response.observacao;
  },
};
