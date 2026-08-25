export type Linha = 'MON' | 'TRI' | 'EPO';

export type TipoBobina = 'AT' | 'BT';

export type Setor = 
  | 'BOBINA AT/BT'
  | 'BOBINA AT'
  | 'BOBINA BT'
  | 'CORTE LASER'
  | 'CORTE DO NUCLEO'
  | 'FERRAGEM'
  | 'ISOLANTE'
  | 'MONTAGEM NUCLEO'
  | 'MONTAGEM FINAL'
  | 'MPA'
  | 'PINTURA'
  | 'SOLDA'
  | 'EPOXI';

export type Perfil = 'APONTADOR' | 'COORDENACAO';
export type StatusAprovacao = 'PENDENTE' | 'APROVADO';
export type OrigemProducao = 'MANUAL' | 'IMPORTADO';
export type Turno = '1º turno' | '2º turno';

export interface User {
  id: string;
  name: string;
  perfil: Perfil;
  setor: Setor | null;
  linhas: Linha[];
}

export interface ProducaoItem {
  id: string;
  linha: Linha;
  potencia: number;
  potenciaFormatted?: string;
  quantidade: number;
}

export interface ParadaFaltaMaterialItem {
  id: string;
  causaMotivo: string;
  material: string;
  horaInicio: string;
  horaFim: string;
  turno?: Turno;
}

export interface ParadaMaquinaItem {
  id: string;
  maquinaEquipamento: string;
  horaInicio: string;
  horaFim: string;
  observacao: string;
  turno?: Turno;
}

export interface NaoConformidadeItem {
  id: string;
  causaNaoConformidade: string;
  op: string;
  numeroSerie: string;
  turno?: Turno;
}

/**
 * O modelo novo de faltas é individual (nome/motivo/atestado).
 * Os campos antigos permanecem opcionais apenas para que registros históricos
 * gravados antes da migração continuem abrindo e possam ser preservados.
 */
export interface FaltaItem {
  id: string;
  nome?: string;
  motivoJustificativa?: string;
  atestado?: boolean;
  linha?: Linha;
  turno?: Turno;
  quantidade?: number;
  justificativa?: string;
}

/**
 * linha/turno são legados. Novos registros usam observacao + justificativaMeta.
 */
export interface ObservacaoItem {
  id: string;
  observacao: string;
  justificativaMeta?: string;
  linha?: Linha;
  turno?: Turno;
}

export interface Apontamento {
  id: string;
  data: string;
  setor: Setor;
  tipoBobina?: TipoBobina;
  userId: string;
  userName: string;
  linhasPermitidas?: Linha[];
  producoes: ProducaoItem[];
  paradasFaltaMaterial?: ParadaFaltaMaterialItem[];
  paradasMaquina?: ParadaMaquinaItem[];
  naoConformidades?: NaoConformidadeItem[];
  faltas: FaltaItem[];
  observacoes: ObservacaoItem[];
  createdAt: string;
  updatedAt: string;
  statusAprovacao?: StatusAprovacao;
  aprovadoEm?: string;
  aprovadoPorId?: string;
  aprovadoPorNome?: string;
  origemProducao?: OrigemProducao;
  complementado?: boolean;
  turno1Complementado?: boolean;
  turno2Complementado?: boolean;
}

export interface ApontamentoComplementoPayload {
  turno?: Turno;
  paradasFaltaMaterial: ParadaFaltaMaterialItem[];
  paradasMaquina: ParadaMaquinaItem[];
  naoConformidades: NaoConformidadeItem[];
  faltas: FaltaItem[];
  observacoes: ObservacaoItem[];
}

export interface ApontamentoEditPayload extends ApontamentoComplementoPayload {
  data: string;
  producoes: ProducaoItem[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface ProductionImportGroup {
  setor: Setor;
  linha: Linha;
  potencia: number;
  quantidade: number;
  tipoBobina?: TipoBobina;
}

export interface ProductionImportRequest {
  data: string;
  grupos: ProductionImportGroup[];
}

export interface ProductionImportMonthDay {
  data: string;
  grupos: ProductionImportGroup[];
}

export interface ProductionImportMonthRequest {
  mesReferencia: string;
  dias: ProductionImportMonthDay[];
}

export interface ProductionImportResult {
  data: string;
  registros: Apontamento[];
  totalQuantidade: number;
  totalUnidades: number;
}

export interface ProductionImportMonthResult {
  mesReferencia: string;
  datasImportadas: number;
  registros: Apontamento[];
  totalQuantidade: number;
  totalUnidades: number;
}

export interface ProgramacaoImportGroup {
  dataProgramada: string;
  setor: string;
  linha: string;
  potencia: string;
  quantidade: number;
}

export interface ProgramacaoImportRequest {
  mesReferencia: string;
  grupos: ProgramacaoImportGroup[];
}

export interface ProgramacaoImportResult {
  mesReferencia: string;
  grupos: number;
  totalQuantidade: number;
}
