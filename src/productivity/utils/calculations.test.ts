import { describe, expect, it } from 'vitest';
import { calculateConvertedQuantity, getStandardDayMinutes, calculateKPIs, productionDateRange } from './calculations';
import type { Employee, ConsolidatedEmployeeDay, ProductionRecord } from '../types';

describe('regras preservadas da Produtividade Individual', () => {
  it('determina o mesmo intervalo da ordenação original, inclusive dados ausentes', () => {
    for (const dates of [[], ['2026-12-31', '2025-01-01', '2026-03-01'], ['', '2026-01-01'], ['2026-01-01', undefined, null]]) {
      const records = dates.map(date => ({date})) as ProductionRecord[];
      const sorted = [...dates].sort();
      expect(productionDateRange(records)).toEqual({startDate: sorted[0] || '', endDate: sorted[sorted.length - 1] || ''});
    }
  });
  it('conta ausências com dias duplicados, intervalo e desligamento inclusivo', () => {
    const employees = [
      { id: '1', firstProductionDate: '2026-01-02', terminationDate: '2026-01-04' },
      { id: '2', firstProductionDate: '2026-01-01' },
    ] as Employee[];
    const days = [
      { employeeId: '1', date: '2026-01-02' },
      { employeeId: '1', date: '2026-01-02' },
      { employeeId: '2', date: '2026-01-04' },
    ] as ConsolidatedEmployeeDay[];
    const workdays = ['2026-01-04', '2026-01-02', '2026-01-03', '2026-01-02', '2026-01-05'];
    expect(calculateKPIs(days, employees, '2026-01-02', '2026-01-05', workdays).totalAbsences).toBe(6);
  });

  it('conserva a contagem original de ausências em diferentes combinações', () => {
    const dates = Array.from({ length: 24 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    for (let seed = 0; seed < 60; seed++) {
      const employees = Array.from({ length: 9 }, (_, i) => ({
        id: String(i), firstProductionDate: dates[(seed + i) % dates.length],
        terminationDate: (seed + i) % 3 === 0 ? dates[(seed * 3 + i * 2) % dates.length] : undefined,
      })) as Employee[];
      const workdays = dates.filter((_, i) => (seed + i) % 4 !== 0).concat(dates[seed % dates.length]);
      const days = employees.flatMap((employee, i) => dates.filter((_, j) => (seed + i + j) % 7 === 0).map(date => ({
        employeeId: employee.id, date, totalConvertedPieces: 0, totalRawPieces: 0,
        totalProducedMinutes: 0, totalAvailableMinutes: 0, totalStoppageMinutes: 0,
      }))) as ConsolidatedEmployeeDay[];
      const start = dates[3], end = dates[20];
      const presence = new Set(days.map(day => `${day.employeeId}|${day.date}`));
      let expected = 0;
      for (const employee of employees) {
        const first = employee.firstProductionDate || employee.admissionDate;
        if (!first) continue;
        const employeeStart = start > first ? start : first;
        for (const date of workdays) {
          if (date < start || date > end || date < employeeStart || (employee.terminationDate && date > employee.terminationDate)) continue;
          if (!presence.has(`${employee.id}|${date}`)) expected++;
        }
      }
      expect(calculateKPIs(days, employees, start, end, workdays).totalAbsences).toBe(expected);
    }
  });
  it('trunca peças convertidas conforme a segunda letra do desenho', () => {
    expect(calculateConvertedQuantity(9, 'AM123')).toBe(4);
    expect(calculateConvertedQuantity(10, 'AT123')).toBe(3);
    expect(calculateConvertedQuantity(9, 'AB123')).toBe(4);
    expect(calculateConvertedQuantity(9, 'AX123')).toBe(9);
  });

  it('mantém 424 minutos de segunda a quinta, 389 na sexta e no fim de semana', () => {
    expect(getStandardDayMinutes('2026-08-31')).toBe(424); // segunda
    expect(getStandardDayMinutes('2026-09-01')).toBe(424); // terça
    expect(getStandardDayMinutes('2026-09-02')).toBe(424); // quarta
    expect(getStandardDayMinutes('2026-09-03')).toBe(424); // quinta
    expect(getStandardDayMinutes('2026-09-04')).toBe(389); // sexta
    expect(getStandardDayMinutes('2026-09-05')).toBe(389); // sábado
    expect(getStandardDayMinutes('2026-09-06')).toBe(389); // domingo
    expect(getStandardDayMinutes('2026-10-10')).toBe(389); // sábado com produção
  });
});
