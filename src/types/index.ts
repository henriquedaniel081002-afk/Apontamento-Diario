export type Linha = 'MON' | 'TRI' | 'EPO';

export type TipoBobina = 'AT' | 'BT';

export type Setor = 
  | 'BOBINA AT/BT'
  | 'BOBINA AT'
  | 'BOBINA BT'
  | 'CORTE LASER'
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

export interface User {
  id: string;
  name: string;
  perfil: Perfil;
  setor: Setor | null;
  linhas: Linha[];
}

export type Turno = '1º turno' | '2º turno';

export interface ProducaoItem {
  id: string;
  linha: Linha;
  potencia: number;
  potenciaFormatted?: string;
  quantidade: number;
}

export interface FaltaItem {
  id: string;
  linha: Linha;
  turno: Turno;
  quantidade: number;
  justificativa?: string;
}

export interface ObservacaoItem {
  id: string;
  linha: Linha;
  turno: Turno;
  observacao: string;
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

export interface ProductionImportResult {
  data: string;
  registros: Apontamento[];
  totalQuantidade: number;
  totalUnidades: number;
}
