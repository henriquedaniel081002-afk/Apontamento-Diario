import { Apontamento } from '../types';
import { apiRequest } from './apiClient';

export const apontamentoService = {
  async getAll(): Promise<Apontamento[]> {
    return apiRequest<Apontamento[]>('/api/apontamentos');
  },

  async getByUserSector(_userId: string, _setor: string): Promise<Apontamento[]> {
    return apiRequest<Apontamento[]>('/api/apontamentos');
  },

  async getByDateAndSector(
    date: string,
    _setor: string,
    _userId: string,
  ): Promise<Apontamento | null> {
    return apiRequest<Apontamento | null>(`/api/apontamentos/data/${encodeURIComponent(date)}`);
  },

  async save(
    apontamentoData: Omit<Apontamento, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Apontamento> {
    return apiRequest<Apontamento>('/api/apontamentos', {
      method: 'POST',
      body: JSON.stringify(apontamentoData),
    });
  },

  async update(
    id: string,
    apontamentoData: Pick<Apontamento, 'data' | 'producoes' | 'faltas' | 'observacoes'>,
  ): Promise<Apontamento> {
    return apiRequest<Apontamento>(`/api/apontamentos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(apontamentoData),
    });
  },

  async delete(id: string): Promise<boolean> {
    await apiRequest<unknown>(`/api/apontamentos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  },
};
