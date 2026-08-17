import { Apontamento } from '../types';
import { apiRequest } from './apiClient';

export const coordenacaoService = {
  async getAll(): Promise<Apontamento[]> {
    return apiRequest<Apontamento[]>('/api/coordenacao/apontamentos');
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

  async delete(id: string): Promise<boolean> {
    await apiRequest<unknown>(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  },
};
