import { describe, expect, it } from 'vitest';
import { previousLocalDate } from './observacoes';
import { isValidDailyObservationDate, isValidDailyObservationScope } from '../../server.producaoDiariaObservacoes';

describe('Observações da Produção Diária', () => {
  it('usa ontem, inclusive ao virar ano', () => {
    expect(previousLocalDate(new Date(2026, 0, 1, 8, 0))).toBe('2025-12-31');
    expect(previousLocalDate(new Date(2026, 10, 10, 8, 0))).toBe('2026-11-09');
  });
  it('uma única observação geral por setor e data', () => {
    expect(isValidDailyObservationScope('MPA', 'GERAL')).toBe(true);
    expect(isValidDailyObservationScope('MONTAGEM FINAL', 'GERAL')).toBe(true);
    expect(isValidDailyObservationScope('BOBINA AT', 'GERAL')).toBe(true);
    expect(isValidDailyObservationScope('MPA', 'MON')).toBe(false);
    expect(isValidDailyObservationScope('MONTAGEM FINAL', 'TRI')).toBe(false);
    expect(isValidDailyObservationScope('BOBINA AT', 'TRI')).toBe(false);
  });
  it('recusa datas inválidas', () => {
    expect(isValidDailyObservationDate('2026-02-29')).toBe(false);
    expect(isValidDailyObservationDate('2026-11-09')).toBe(true);
    expect(isValidDailyObservationDate('2026-13-01')).toBe(false);
  });
});
