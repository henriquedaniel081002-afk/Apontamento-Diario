import { Apontamento, ApontamentoEditPayload, ProductionImportMonthRequest, ProductionImportMonthResult, ProductionImportRequest, ProductionImportResult, ProgramacaoImportRequest, ProgramacaoImportResult, StatusAprovacao } from '../types';
import { apiRequest } from './apiClient';
import { invalidateDashboardCache } from './dashboardService';

const CACHE_TTL_MS = 20_000;
let cachedRecords: Apontamento[] | null = null;
let cachedAt = 0;
let pendingRequest: Promise<Apontamento[]> | null = null;

function invalidateRecordsCache() {
  cachedRecords = null;
  cachedAt = 0;
  pendingRequest = null;
}

function invalidateAfterMutation() {
  invalidateRecordsCache();
  invalidateDashboardCache();
}

export const coordenacaoService = {
  async getAll(forceRefresh = false): Promise<Apontamento[]> {
    const now = Date.now();
    if (!forceRefresh && cachedRecords && now - cachedAt < CACHE_TTL_MS) return cachedRecords;
    if (!forceRefresh && pendingRequest) return pendingRequest;

    pendingRequest = apiRequest<Apontamento[]>('/api/coordenacao/apontamentos', { cache: 'no-store' })
      .then((data) => {
        cachedRecords = data;
        cachedAt = Date.now();
        return data;
      })
      .finally(() => {
        pendingRequest = null;
      });
    return pendingRequest;
  },

  async importProduction(payload: ProductionImportRequest): Promise<ProductionImportResult> {
    const result = await apiRequest<ProductionImportResult>('/api/coordenacao/importar-producao', {
      method: 'POST', body: JSON.stringify(payload),
    });
    invalidateAfterMutation();
    return result;
  },

  async importProductionMonth(payload: ProductionImportMonthRequest): Promise<ProductionImportMonthResult> {
    // Evita uma única requisição longa para o mês inteiro. Em ambientes serverless
    // (como Vercel), processar todos os dias dentro da mesma Function pode exceder
    // o tempo máximo e resultar em "Falha ao conectar com servidor".
    // Cada dia é substituído de forma idempotente e, ao final, o servidor remove
    // produções antigas de dias que não aparecem no novo arquivo.
    let totalQuantidade = 0;
    let totalUnidades = 0;
    const datasImportadas: string[] = [];

    for (const day of payload.dias) {
      const result = await apiRequest<ProductionImportResult>('/api/coordenacao/importar-producao', {
        method: 'POST',
        body: JSON.stringify({
          data: day.data,
          grupos: day.grupos,
          setorFiltro: payload.setorFiltro,
          compacto: true,
        }),
      });
      datasImportadas.push(day.data);
      totalQuantidade += result.totalQuantidade;
      totalUnidades += result.totalUnidades;
    }

    await apiRequest<{ ok: boolean }>('/api/coordenacao/importar-producao-mes-finalizar', {
      method: 'POST',
      body: JSON.stringify({
        mesReferencia: payload.mesReferencia,
        datasImportadas,
        setorFiltro: payload.setorFiltro,
      }),
    });

    const result: ProductionImportMonthResult = {
      mesReferencia: payload.mesReferencia,
      datasImportadas: datasImportadas.length,
      registros: [],
      totalQuantidade,
      totalUnidades,
    };
    invalidateAfterMutation();
    return result;
  },

  async importProgramacao(payload: ProgramacaoImportRequest): Promise<ProgramacaoImportResult> {
    const result = await apiRequest<ProgramacaoImportResult>('/api/coordenacao/importar-programacao', {
      method: 'POST', body: JSON.stringify(payload),
    });
    invalidateAfterMutation();
    return result;
  },

  async update(id: string, data: ApontamentoEditPayload): Promise<Apontamento> {
    const result = await apiRequest<Apontamento>(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
    invalidateAfterMutation();
    return result;
  },

  async setApproval(id: string, status: StatusAprovacao): Promise<Apontamento> {
    const result = await apiRequest<Apontamento>(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}/aprovacao`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    });
    invalidateAfterMutation();
    return result;
  },

  async delete(id: string): Promise<boolean> {
    await apiRequest<unknown>(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    invalidateAfterMutation();
    return true;
  },

  async deleteBulk(payload: { data?: string; mesReferencia?: string; setor?: string }): Promise<{ totalExcluidos: number }> {
    const result = await apiRequest<{ ok: boolean; totalExcluidos: number }>('/api/coordenacao/excluir-apontamentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    invalidateAfterMutation();
    return { totalExcluidos: result.totalExcluidos };
  },
};
