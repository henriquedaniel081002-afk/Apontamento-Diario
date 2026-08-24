import { Apontamento, Linha, Setor } from '../types';

export type HistoryPeriod = 'ALL' | '7DAYS' | 'MONTH';

export interface HistoryFilters {
  data?: string;
  linha: string;
  period: HistoryPeriod;
  search: string;
}

export interface CoordinationFilters {
  data: string;
  setor: string;
  linha: string;
  potencia: string;
}

export interface OperationalUnit {
  id: string;
  label: string;
  setor: Setor;
  linha?: Linha;
  tipoBobina?: 'AT' | 'BT';
}

/**
 * The twelve reporting units agreed by the operation. Keep split units split:
 * AT/BT, MON/TRI in Montagem Final and MON/TRI in MPA are independent.
 */
export const OPERATIONAL_UNITS: readonly OperationalUnit[] = [
  { id: 'BOBINA AT', label: 'Bobina AT', setor: 'BOBINA AT', tipoBobina: 'AT' },
  { id: 'BOBINA BT', label: 'Bobina BT', setor: 'BOBINA BT', tipoBobina: 'BT' },
  { id: 'CORTE LASER', label: 'Corte do Laser', setor: 'CORTE LASER' },
  { id: 'ISOLANTE', label: 'Isolante', setor: 'ISOLANTE' },
  { id: 'MONTAGEM NUCLEO', label: 'Montagem do Núcleo', setor: 'MONTAGEM NUCLEO' },
  { id: 'MONTAGEM FINAL MON', label: 'Montagem Final MON', setor: 'MONTAGEM FINAL', linha: 'MON' },
  { id: 'MONTAGEM FINAL TRI', label: 'Montagem Final TRI', setor: 'MONTAGEM FINAL', linha: 'TRI' },
  { id: 'MPA MON', label: 'MPA MON', setor: 'MPA', linha: 'MON' },
  { id: 'MPA TRI', label: 'MPA TRI', setor: 'MPA', linha: 'TRI' },
  { id: 'PINTURA', label: 'Pintura', setor: 'PINTURA' },
  { id: 'SOLDA', label: 'Solda', setor: 'SOLDA' },
  { id: 'EPOXI', label: 'Epóxi', setor: 'EPOXI' },
] as const;

export function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousWorkingDayYmd(reference = new Date()): string {
  const date = new Date(reference);
  const day = date.getDay();
  const daysToSubtract = day === 1 ? 3 : day === 0 ? 2 : 1;
  date.setDate(date.getDate() - daysToSubtract);
  return formatLocalYmd(date);
}

export function getApontamentoLines(apontamento: Apontamento): Linha[] {
  const values = [
    ...(apontamento.linhasPermitidas || []),
    ...apontamento.producoes.map((item) => item.linha),
    ...apontamento.faltas.map((item) => item.linha).filter(Boolean),
    ...apontamento.observacoes.map((item) => item.linha).filter(Boolean),
  ];

  const order: Linha[] = ['MON', 'TRI', 'EPO'];
  return order.filter((linha) => values.includes(linha));
}

export function apontamentoTemLinha(apontamento: Apontamento, linha: Linha): boolean {
  return getApontamentoLines(apontamento).includes(linha);
}

function apontamentoHasRecordedLine(apontamento: Apontamento, linha: string): boolean {
  return apontamento.producoes.some((item) => item.linha === linha)
    || apontamento.faltas.some((item) => item.linha === linha)
    || apontamento.observacoes.some((item) => item.linha === linha);
}

export function getApontamentoTotals(apontamento: Apontamento) {
  return {
    producao: apontamento.producoes.reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
    faltas: apontamento.faltas.reduce((sum, item) => sum + (typeof item.quantidade === 'number' ? Number(item.quantidade || 0) : 1), 0),
    observacoes: apontamento.observacoes.length,
  };
}

export function getOperationalUnitLabel(apontamento: Apontamento): string {
  if (apontamento.setor === 'BOBINA AT/BT' && apontamento.tipoBobina) {
    return `Bobina ${apontamento.tipoBobina}`;
  }

  const baseLabels: Partial<Record<Setor, string>> = {
    'BOBINA AT': 'Bobina AT',
    'BOBINA BT': 'Bobina BT',
    'CORTE LASER': 'Corte do Laser',
    'CORTE DO NUCLEO': 'Corte do Núcleo',
    FERRAGEM: 'Ferragem',
    ISOLANTE: 'Isolante',
    'MONTAGEM NUCLEO': 'Montagem do Núcleo',
    'MONTAGEM FINAL': 'Montagem Final',
    MPA: 'MPA',
    PINTURA: 'Pintura',
    SOLDA: 'Solda',
    EPOXI: 'Epóxi',
  };
  const base = baseLabels[apontamento.setor] || String(apontamento.setor);
  const lines = getApontamentoLines(apontamento);

  if ((apontamento.setor === 'MONTAGEM FINAL' || apontamento.setor === 'MPA') && lines.length) {
    return `${base} ${lines.join(' / ')}`;
  }
  return base;
}

function unitMatchesSector(unit: OperationalUnit, apontamento: Apontamento): boolean {
  if (unit.tipoBobina) {
    return apontamento.setor === unit.setor || (
      apontamento.setor === 'BOBINA AT/BT' && apontamento.tipoBobina === unit.tipoBobina
    );
  }
  return apontamento.setor === unit.setor;
}

export function operationalUnitWasReported(
  unit: OperationalUnit,
  apontamentosDoDia: readonly Apontamento[],
): boolean {
  return apontamentosDoDia.some((apontamento) => {
    if (apontamento.origemProducao === 'IMPORTADO' && apontamento.complementado === false) return false;
    if (!unitMatchesSector(unit, apontamento)) return false;
    if (!unit.linha) return true;
    return apontamentoTemLinha(apontamento, unit.linha);
  });
}

export function getOperationalStatus(apontamentos: readonly Apontamento[], data: string) {
  const apontamentosDoDia = data
    ? apontamentos.filter((apontamento) => apontamento.data === data)
    : [];
  const pendingUnits = OPERATIONAL_UNITS.filter(
    (unit) => !operationalUnitWasReported(unit, apontamentosDoDia),
  );

  return {
    records: apontamentosDoDia.length,
    totalUnits: OPERATIONAL_UNITS.length,
    completedUnits: OPERATIONAL_UNITS.length - pendingUnits.length,
    pendingUnits,
  };
}

/**
 * Characterizes the pre-redesign behavior for “Últimos 7 dias”. The threshold
 * intentionally retains the current time of day; changing it to midnight would
 * alter the existing boundary and therefore the business behavior.
 */
export function matchesHistoryPeriod(
  dateString: string,
  period: HistoryPeriod,
  reference = new Date(),
): boolean {
  const recordDate = new Date(`${dateString}T00:00:00`);

  if (period === '7DAYS') {
    const sevenDaysAgo = new Date(reference);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return !(recordDate < sevenDaysAgo);
  }

  if (period === 'MONTH') {
    return recordDate.getMonth() === reference.getMonth()
      && recordDate.getFullYear() === reference.getFullYear();
  }

  return true;
}

export function filterHistoryApontamentos(
  apontamentos: readonly Apontamento[],
  filters: HistoryFilters,
  reference = new Date(),
): Apontamento[] {
  return apontamentos.filter((apontamento) => {
    if (filters.data && apontamento.data !== filters.data) {
      return false;
    }

    if (filters.linha !== 'ALL' && !apontamentoHasRecordedLine(apontamento, filters.linha)) {
      return false;
    }

    if (filters.search.trim()) {
      // Preserve the current search behavior, including the literal outer spaces.
      const term = filters.search.toLocaleLowerCase('pt-BR');
      const [year, month, day] = apontamento.data.split('-');
      const formattedDate = year && month && day ? `${day}/${month}/${year}` : apontamento.data;
      const matchesDate = formattedDate.toLocaleLowerCase('pt-BR').includes(term)
        || apontamento.data.toLocaleLowerCase('pt-BR').includes(term);
      const matchesObservation = apontamento.observacoes.some((item) =>
        item.observacao.toLocaleLowerCase('pt-BR').includes(term),
      );
      if (!matchesDate && !matchesObservation) return false;
    }

    return matchesHistoryPeriod(apontamento.data, filters.period, reference);
  });
}

export function filterCoordinationApontamentos(
  apontamentos: readonly Apontamento[],
  filters: CoordinationFilters,
): Apontamento[] {
  return apontamentos.filter((apontamento) => {
    if (filters.data && apontamento.data !== filters.data) return false;
    if (filters.setor !== 'ALL' && apontamento.setor !== filters.setor) return false;
    if (filters.linha !== 'ALL' && !apontamentoHasRecordedLine(apontamento, filters.linha)) return false;

    if (filters.potencia !== 'ALL') {
      const wanted = Number(filters.potencia);
      const matchesPower = apontamento.producoes.some((item) =>
        Math.abs(Number(item.potencia) - wanted) < 0.001
        && (filters.linha === 'ALL' || item.linha === filters.linha),
      );
      if (!matchesPower) return false;
    }

    return true;
  });
}
