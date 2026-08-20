import { Apontamento, ApontamentoComplementoPayload, ApontamentoEditPayload } from '../types';
import { apiRequest } from './apiClient';

export const apontamentoService = {
  async getAll(): Promise<Apontamento[]> {
    return apiRequest<Apontamento[]>('/api/apontamentos');
  },
  async getPendingImported(): Promise<Apontamento[]> {
    return apiRequest<Apontamento[]>('/api/apontamentos/importados/pendentes');
  },
  async getByUserSector(_userId: string, _setor: string): Promise<Apontamento[]> {
    return apiRequest<Apontamento[]>('/api/apontamentos');
  },
  async getByDateAndSector(date: string, _setor: string, _userId: string): Promise<Apontamento | null> {
    return apiRequest<Apontamento | null>(`/api/apontamentos/data/${encodeURIComponent(date)}`);
  },
  async completeImported(id: string, data: ApontamentoComplementoPayload): Promise<Apontamento> {
    return apiRequest<Apontamento>(`/api/apontamentos/${encodeURIComponent(id)}/complemento`, {
      method: 'PUT', body: JSON.stringify(data),
    });
  },
  async update(id: string, apontamentoData: ApontamentoEditPayload): Promise<Apontamento> {
    return apiRequest<Apontamento>(`/api/apontamentos/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(apontamentoData),
    });
  },
  async delete(id: string): Promise<boolean> {
    await apiRequest<unknown>(`/api/apontamentos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  },
};
