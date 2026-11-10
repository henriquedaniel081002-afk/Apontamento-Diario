export type DailyObservationLine = 'GERAL' | 'MON' | 'TRI';
export interface DailyProductionObservation {
  data: string;
  setor: string;
  linha: DailyObservationLine;
  observacao: string;
  atualizado_em: string;
  atualizado_por_login: string;
}
export function previousLocalDate(now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
