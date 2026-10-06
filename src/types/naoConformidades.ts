import type { TipoBobina, Turno } from './index';

export type StatusReparo = 'AGUARDANDO_REPARO' | 'REPARADO';

// Modelo analítico separado do formulário operacional existente.
export interface NaoConformidadeDashboardItem {
  id: string;
  apontamentoId: string;
  data: string;
  setorId: string;
  setor: string;
  tipoBobina?: TipoBobina;
  turno?: Turno;
  op: string;
  numeroSerie: string;
  causaNaoConformidade: string;
  criadoEm: string;
  statusReparo: StatusReparo;
  descricaoReparo?: string;
  reparadoEm?: string;
  reparadoPorId?: string;
  reparadoPorNome?: string;
}

export interface NaoConformidadesFiltros {
  dataInicio: string;
  dataFim: string;
  setorId: string;
  status: StatusReparo | 'ALL';
  busca: string;
}

export interface NaoConformidadesResponse {
  registros: NaoConformidadeDashboardItem[];
  setores: Array<{ id: string; nome: string }>;
}
