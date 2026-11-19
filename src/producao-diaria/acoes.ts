import type { DailyObservationLine } from './escopo';

export const ACTION_STATUSES = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'] as const;
export type ActionStatus = typeof ACTION_STATUSES[number];
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};
export const ACTION_OBSERVATION_LIMIT = 3000;
export const ACTION_PLAN_LIMIT = 3000;
export const ACTION_RESPONSIBLE_LIMIT = 200;

export interface ActionFields {
  setor: string;
  linha: DailyObservationLine;
  observacao: string | null;
  plano_acao: string | null;
  responsavel: string | null;
  prazo: string | null;
  situacao: ActionStatus;
}

export interface DailyAction extends ActionFields {
  id: string;
  data_origem: string;
  versao: number;
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
  criado_por_login: string;
  atualizado_por_login: string;
}

export type ActionFilterStatus = 'ABERTAS' | 'TODAS' | ActionStatus;
export interface ActionFilters {
  status?: ActionFilterStatus;
  setor?: string;
  linha?: DailyObservationLine;
  dataOrigem?: string;
  incluirGeral?: boolean;
  cursor?: string;
}

type ActionEventSnapshot = Omit<ActionFields, 'observacao'> & {
  data_origem: string;
  observacao?: string | null;
};

export interface ActionEvent {
  id: string;
  tipo: 'CRIACAO' | 'ALTERACAO';
  autor_login: string;
  criado_em: string;
  antes: ActionEventSnapshot | null;
  depois: ActionEventSnapshot;
}

export interface ActionPage {
  acoes: DailyAction[];
  proximoCursor: string | null;
}

export interface ActionHistoryPage {
  eventos: ActionEvent[];
  proximoCursor: string | null;
}

export function isActionStatus(value: unknown): value is ActionStatus {
  return ACTION_STATUSES.some((status) => status === value);
}

export function isOverdue(action: Pick<DailyAction, 'prazo' | 'situacao'>, today: string): boolean {
  return action.prazo !== null && (action.situacao === 'PENDENTE' || action.situacao === 'EM_ANDAMENTO') && action.prazo < today;
}
