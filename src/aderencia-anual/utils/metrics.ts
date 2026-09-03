import type {
  AderenciaAnualMetrics,
  AderenciaAnualRecord,
  AnnualComparisonRow,
} from '../types';

export const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

interface MonthReference {
  year: number;
  month: number;
}

function getMonthReference(value: string): MonthReference | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function numericValue(value: number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function deriveAvailableYears(records: AderenciaAnualRecord[]): number[] {
  return Array.from(new Set(
    records
      .map((record) => getMonthReference(record.mes)?.year)
      .filter((year): year is number => typeof year === 'number'),
  )).sort((a, b) => a - b);
}

export function calculateAnnualMetrics(
  records: AderenciaAnualRecord[],
  selectedYear: number,
  today = new Date(),
): AderenciaAnualMetrics {
  const selectedRecords = records.filter((record) => getMonthReference(record.mes)?.year === selectedYear);
  const totalWorkdays = selectedRecords.reduce((sum, record) => sum + numericValue(record.dias_uteis), 0);
  const totalProduced = selectedRecords.reduce((sum, record) => sum + numericValue(record.realizado), 0);

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const adherenceRecords = selectedRecords.filter((record) => {
    const reference = getMonthReference(record.mes);
    if (!reference) return false;
    if (selectedYear < currentYear) return true;
    if (selectedYear > currentYear) return false;
    return reference.month <= currentMonth;
  });

  const programmedToPeriod = adherenceRecords.reduce(
    (sum, record) => sum + numericValue(record.programado),
    0,
  );
  const producedToPeriod = adherenceRecords.reduce(
    (sum, record) => sum + numericValue(record.realizado),
    0,
  );

  return {
    averageWorkdays: selectedRecords.length > 0 ? totalWorkdays / selectedRecords.length : null,
    adherence: programmedToPeriod > 0 ? (producedToPeriod / programmedToPeriod) * 100 : null,
    totalProduced,
    monthCount: selectedRecords.length,
    adherenceMonthCount: adherenceRecords.length,
  };
}

export function buildAnnualComparison(
  records: AderenciaAnualRecord[],
  years = deriveAvailableYears(records),
): AnnualComparisonRow[] {
  return MONTH_LABELS.map((month, index) => {
    const comparison: AnnualComparisonRow = {
      month,
      monthNumber: index + 1,
    };

    for (const year of years) comparison[String(year)] = null;

    for (const record of records) {
      const reference = getMonthReference(record.mes);
      if (!reference || reference.month !== index + 1 || !years.includes(reference.year)) continue;
      comparison[String(reference.year)] = record.realizado == null
        ? 0
        : numericValue(record.realizado);
    }

    return comparison;
  });
}
