import { apiRequest } from '../../services/apiClient';
import type { AtrasoRecord } from '../types';

interface AtrasoListResponse {
  rows: AtrasoRecord[];
}

interface AtrasoImportResponse {
  imported: number;
}

function normalizeRecord(row: any): AtrasoRecord {
  return {
    serie: Number(row.serie),
    potencia: row.potencia === null || row.potencia === undefined || row.potencia === '' ? null : Number(row.potencia),
    linha: String(row.linha || '').trim(),
    op: row.op === null || row.op === undefined || row.op === '' ? null : Number(row.op),
    cliente: String(row.cliente || '').trim(),
    data_programada: String(row.data_programada || '').slice(0, 10),
    setor: String(row.setor || '').trim(),
    status: String(row.status || '').trim().toUpperCase() as AtrasoRecord['status'],
  };
}

export const atrasoService = {
  async getAll(): Promise<AtrasoRecord[]> {
    const response = await apiRequest<AtrasoListResponse>('/api/coordenacao/controle-atrasos');
    return (response.rows || []).map(normalizeRecord);
  },

  async replaceAll(rows: AtrasoRecord[]): Promise<AtrasoImportResponse> {
    if (!rows.length) throw new Error('O arquivo não possui registros de ATRASO ou ADIANTAMENTO para importar.');

    return apiRequest<AtrasoImportResponse>('/api/coordenacao/controle-atrasos/importar', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};
