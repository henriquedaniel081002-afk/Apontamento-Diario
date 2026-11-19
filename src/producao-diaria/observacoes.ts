import type { DailyObservationLine } from './escopo';
export type { DailyObservationLine } from './escopo';

export interface DailyProductionObservation {
  data: string;
  setor: string;
  linha: DailyObservationLine;
  observacao: string;
  atualizado_em: string;
  atualizado_por_login: string;
  versao: number;
}

const manausDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayInManaus(now = new Date()): string {
  const parts = manausDate.formatToParts(now);
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)?.value).join('-');
}

export function previousLocalDate(now = new Date()): string {
  const day = new Date(`${todayInManaus(now)}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
