export const DAILY_LINES = ['GERAL', 'MON', 'TRI', 'EPO'] as const;
export type DailyObservationLine = typeof DAILY_LINES[number];

export const DAILY_SECTORS = [
  'BOBINA AT', 'BOBINA BT', 'BOBINAGEM EPOXI', 'CORTE DO LASER', 'CORTE DO NUCLEO',
  'ENCAPSULAMENTO', 'EPOXI', 'FERRAGEM', 'ISOLANTE', 'MONTAGEM DO NUCLEO',
  'MONTAGEM FINAL', 'MPA', 'PINTURA', 'SOLDA',
] as const;

const epoxiSectors = new Set<string>(['EPOXI', 'BOBINAGEM EPOXI', 'ENCAPSULAMENTO']);

export function dailySectorLines(setor: string): readonly DailyObservationLine[] {
  if (!isDailySector(setor)) return [];
  // O domínio operacional aceita EPO nos setores convencionais e restringe a área Epóxi à EPO.
  return epoxiSectors.has(setor) ? ['GERAL', 'EPO'] : DAILY_LINES;
}

export function isDailySector(value: unknown): value is typeof DAILY_SECTORS[number] {
  return typeof value === 'string' && DAILY_SECTORS.some((setor) => setor === value);
}

export function isDailyLine(value: unknown): value is DailyObservationLine {
  return DAILY_LINES.some((line) => line === value);
}

export function isValidDailyObservationScope(setor: unknown, linha: unknown): boolean {
  return isDailySector(setor) && isDailyLine(linha) && dailySectorLines(setor).includes(linha);
}

export function isValidDailyObservationDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
