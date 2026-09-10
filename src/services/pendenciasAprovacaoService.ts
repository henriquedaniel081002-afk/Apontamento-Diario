import { apiRequest } from './apiClient';

export const PENDING_TYPES = {
  MATERIAL: 'Falta de Material',
  MAQUINA: 'Máquina Quebrada',
  NC: 'Não Conformidade',
  FALTAS: 'Faltas',
  OBSERVACOES: 'Observações',
} as const;

export interface PendingOccurrence {
  id: string;
  tipo: keyof typeof PENDING_TYPES;
  linha: string | null;
  turno: string | null;
  detalhes: Record<string, string | number | boolean | null>;
}

export interface PendingApproval {
  id: string;
  data: string;
  setor: string;
  createdAt: string;
  versao: string;
  statusAprovacao: 'PENDENTE';
  possuiProducao: boolean;
  origemProducao: string;
  complementado: boolean | null;
  totalOcorrencias: number;
  ocorrencias: PendingOccurrence[];
}

export interface PendingApprovalResult {
  total: number;
  totalOcorrencias: number;
  totalFiltrado: number;
  setores: string[];
  pagina: number;
  tamanhoPagina: number;
  registros: PendingApproval[];
}

export interface PendingApprovalFilters {
  dataInicio: string;
  dataFim: string;
  setor: string;
  tipo: string;
}

export const pendenciasAprovacaoService = {
  get(filters: PendingApprovalFilters, pagina: number, resumo: boolean, signal?: AbortSignal) {
    const query = new URLSearchParams({ ...filters, pagina: String(pagina), resumo: String(resumo) });
    return apiRequest<PendingApprovalResult>(`/api/coordenacao/pendencias-aprovacao?${query}`, {
      cache: 'no-store', signal,
    });
  },
};
