import { Apontamento, ApontamentoEditPayload, ProductionImportRequest, ProductionImportResult, ProgramacaoImportRequest, ProgramacaoImportResult, StatusAprovacao } from '../types';
import { apiRequest } from './apiClient';

export const coordenacaoService = {
  async getAll(): Promise<Apontamento[]> {
    const cacheBust = Date.now();
    return apiRequest<Apontamento[]>(`/api/coordenacao/apontamentos?_=${cacheBust}`, {
      cache: 'no-store',
    });
  },



  async importProduction(payload: ProductionImportRequest): Promise<ProductionImportResult> {
    return apiRequest<ProductionImportResult>('/api/coordenacao/importar-producao', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async importProgramacao(payload: ProgramacaoImportRequest): Promise<ProgramacaoImportResult> {
    return apiRequest<ProgramacaoImportResult>('/api/coordenacao/importar-programacao', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(
    id: string,
    data: ApontamentoEditPayload,
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
