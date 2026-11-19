import { describe, expect, it } from 'vitest';
import { isOverdue } from './acoes';
import { previousLocalDate, todayInManaus } from './observacoes';
import { isValidDailyObservationDate, isValidDailyObservationScope } from '../../server.producaoDiariaObservacoes';

describe('Observações da Produção Diária', () => {
  it('usa ontem, inclusive ao virar ano', () => {
    expect(previousLocalDate(new Date('2026-01-01T04:00:00Z'))).toBe('2025-12-31');
    expect(previousLocalDate(new Date('2026-11-10T15:00:00Z'))).toBe('2026-11-09');
  });
  it('valida linhas independentes por setor canônico', () => {
    expect(isValidDailyObservationScope('MPA', 'GERAL')).toBe(true);
    expect(isValidDailyObservationScope('MONTAGEM FINAL', 'GERAL')).toBe(true);
    expect(isValidDailyObservationScope('BOBINA AT', 'GERAL')).toBe(true);
    expect(isValidDailyObservationScope('MPA', 'MON')).toBe(true);
    expect(isValidDailyObservationScope('MONTAGEM FINAL', 'TRI')).toBe(true);
    expect(isValidDailyObservationScope('BOBINA AT', 'TRI')).toBe(true);
    expect(isValidDailyObservationScope('CORTE DO LASER', 'MON')).toBe(true);
    expect(isValidDailyObservationScope('EPOXI', 'EPO')).toBe(true);
    expect(isValidDailyObservationScope('ENCAPSULAMENTO', 'MON')).toBe(false);
    expect(isValidDailyObservationScope('CORTE LASER', 'GERAL')).toBe(false);
    expect(isValidDailyObservationScope('DESCONHECIDO', 'GERAL')).toBe(false);
  });
  it('calcula vencimento na virada de ano em Manaus', () => {
    const beforeMidnight = todayInManaus(new Date('2026-01-01T03:59:59Z'));
    const afterMidnight = todayInManaus(new Date('2026-01-01T04:00:00Z'));
    const action = { prazo: '2025-12-31', situacao: 'PENDENTE' as const };
    expect(isOverdue(action, beforeMidnight)).toBe(false);
    expect(isOverdue(action, afterMidnight)).toBe(true);
    expect(isOverdue({ ...action, situacao: 'CONCLUIDA' }, afterMidnight)).toBe(false);
    expect(isOverdue({ ...action, situacao: 'CANCELADA' }, afterMidnight)).toBe(false);
  });
  it('recusa datas inválidas', () => {
    expect(isValidDailyObservationDate('2026-02-29')).toBe(false);
    expect(isValidDailyObservationDate('2026-11-09')).toBe(true);
    expect(isValidDailyObservationDate('2026-13-01')).toBe(false);
  });
});
