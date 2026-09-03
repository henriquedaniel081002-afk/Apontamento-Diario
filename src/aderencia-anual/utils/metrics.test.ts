import { describe, expect, it } from 'vitest';
import type { AderenciaAnualRecord } from '../types';
import { buildAnnualComparison, calculateAnnualMetrics, deriveAvailableYears } from './metrics';

const records: AderenciaAnualRecord[] = [
  { mes: '2024-01-01', programado: 100, realizado: 90, dias_uteis: 20 },
  { mes: '2024-03-01', programado: 200, realizado: 210, dias_uteis: 22 },
  { mes: '2025-01-01', programado: 120, realizado: 115, dias_uteis: 21 },
  { mes: '2026-01-01', programado: 100, realizado: 95, dias_uteis: 20 },
  { mes: '2026-09-01', programado: 200, realizado: 100, dias_uteis: 21 },
  { mes: '2026-10-01', programado: 300, realizado: 0, dias_uteis: 22 },
];

describe('métricas da Aderência Anual', () => {
  it('deriva os anos dinamicamente e em ordem cronológica', () => {
    expect(deriveAvailableYears(records)).toEqual([2024, 2025, 2026]);
  });

  it('usa somente os meses existentes no cálculo da média e limita a aderência do ano atual ao mês corrente', () => {
    const result = calculateAnnualMetrics(records, 2026, new Date(2026, 8, 3));

    expect(result.averageWorkdays).toBe(21);
    expect(result.totalProduced).toBe(195);
    expect(result.adherence).toBe(65);
    expect(result.monthCount).toBe(3);
    expect(result.adherenceMonthCount).toBe(2);
  });

  it('calcula anos encerrados com todos os registros existentes', () => {
    const result = calculateAnnualMetrics(records, 2024, new Date(2026, 8, 3));

    expect(result.averageWorkdays).toBe(21);
    expect(result.totalProduced).toBe(300);
    expect(result.adherence).toBe(100);
  });

  it('monta o comparativo com todos os anos e preserva meses inexistentes como ausência de barra', () => {
    const years = deriveAvailableYears(records);
    const comparison = buildAnnualComparison(records, years);

    expect(comparison).toHaveLength(12);
    expect(comparison[0]).toMatchObject({ month: 'Jan', '2024': 90, '2025': 115, '2026': 95 });
    expect(comparison[1]).toMatchObject({ month: 'Fev', '2024': null, '2025': null, '2026': null });
    expect(comparison[2]).toMatchObject({ month: 'Mar', '2024': 210, '2025': null, '2026': null });
  });
});
