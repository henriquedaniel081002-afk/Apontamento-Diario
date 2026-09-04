import type { DailyProductionResponse } from '../producao-diaria/types';
import { apiRequest } from './apiClient';

export const producaoDiariaService = {
  getData(dataInicio: string, dataFim: string, linha = 'ALL'): Promise<DailyProductionResponse> {
    const params = new URLSearchParams({ dataInicio, dataFim, linha });
    return apiRequest<DailyProductionResponse>(
      `/api/coordenacao/producao-diaria?${params.toString()}`,
      { cache: 'no-store' },
    );
  },
};
