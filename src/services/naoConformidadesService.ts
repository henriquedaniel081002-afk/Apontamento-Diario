import { apiRequest } from './apiClient';
import type { NaoConformidadeDashboardItem, NaoConformidadesFiltros, NaoConformidadesResponse } from '../types/naoConformidades';

export const naoConformidadesService = {
  listar(filtros: NaoConformidadesFiltros): Promise<NaoConformidadesResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filtros)) {
      if (value) params.set(key, value);
    }
    return apiRequest<NaoConformidadesResponse>(`/api/nao-conformidades?${params}`, { cache: 'no-store' });
  },

  reparar(id: string, descricaoReparo: string): Promise<NaoConformidadeDashboardItem> {
    return apiRequest<NaoConformidadeDashboardItem>(`/api/nao-conformidades/${encodeURIComponent(id)}/reparar`, {
      method: 'PATCH',
      body: JSON.stringify({ descricaoReparo }),
    });
  },
};
