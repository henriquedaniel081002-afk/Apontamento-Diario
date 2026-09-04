import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../../dashboard/types';
import type { AderenciaAnualRecord } from '../types';
import {
  buildAnnualComparison,
  calculateAnnualMetrics,
  calculateMontagemFinalPartialProgrammed,
  deriveAvailableYears,
} from './metrics';

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


  it('usa o Programado Parcial da Montagem Final no mês atual sem alterar os meses anteriores', () => {
    const result = calculateAnnualMetrics(records, 2026, new Date(2026, 8, 4), 50);

    // Jan = 100 (base anual) + Set = 50 (parcial mensal); Out continua fora do período.
    expect(result.adherence).toBe(130);
    expect(result.adherenceMonthCount).toBe(2);
  });

  it('calcula o Programado Parcial da Montagem Final até o dia anterior, igual à Aderência Mensal', () => {
    const dashboardData = {
      programacao: [
        { data: '2026-09-01', setor: 'MONTAGEM FINAL', linha: 'MON', quantidade: 100 },
        { data: '2026-09-02', setor: 'MONTAGEM FINAL', linha: 'TRI', quantidade: 150 },
        { data: '2026-09-03', setor: 'MONTAGEM FINAL', linha: 'MON', quantidade: 127 },
        { data: '2026-09-04', setor: 'MONTAGEM FINAL', linha: 'TRI', quantidade: 200 },
        { data: '2026-09-02', setor: 'MPA', linha: 'MON', quantidade: 999 },
      ],
    } as DashboardData;

    expect(calculateMontagemFinalPartialProgrammed(dashboardData, new Date(2026, 8, 4))).toBe(377);
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
