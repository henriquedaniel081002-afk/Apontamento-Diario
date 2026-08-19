import { Apontamento, StatusAprovacao } from '../types';
import { apiRequest } from './apiClient';

export const coordenacaoService = {
  async getAll(): Promise<Apontamento[]> {
    const cacheBust = Date.now();
    return apiRequest<Apontamento[]>(`/api/coordenacao/apontamentos?_=${cacheBust}`, {
      cache: 'no-store',
    });
  },

  async update(
    id: string,
    data: Pick<Apontamento, 'data' | 'producoes' | 'faltas' | 'observacoes'>,
  ): Promise<Apontamento> {
    return apiRequest<Apontamento>(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async setApproval(id: string, status: StatusAprovacao): Promise<Apontamento> {
    return apiRequest<Apontamento>(
      `/api/coordenacao/apontamentos/${encodeURIComponent(id)}/aprovacao`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );
  },

  async delete(id: string): Promise<boolean> {
    await apiRequest<unknown>(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  },
};
