import { describe, expect, it } from 'vitest';
import { buildDailyProductionMetrics, calculateAdherence, isBelowDailyProgramming } from './metrics';

describe('métricas da Produção Diária', () => {
  it('calcula aderência para igualdade, produção superior e produção zerada', () => {
    expect(calculateAdherence(100, 100)).toBe(100);
    expect(calculateAdherence(100, 120)).toBe(120);
    expect(calculateAdherence(100, 0)).toBe(0);
  });

  it('mantém aderência indisponível quando não existe programação', () => {
    expect(calculateAdherence(0, 0)).toBeNull();
    expect(calculateAdherence(0, 25)).toBeNull();
  });

  it('calcula o total ponderado, sem usar média simples dos setores', () => {
    const result = buildDailyProductionMetrics([
      { setor: 'BOBINAGEM', programado: 100, produzido: 100 },
      { setor: 'PINTURA', programado: 300, produzido: 150 },
    ]);

    expect(result.totais).toEqual({ programado: 400, produzido: 250, aderencia: 62.5 });
    expect(result.setores.map((row) => row.aderencia)).toEqual([100, 50]);
  });

  it('identifica uma linha atrasada mesmo quando o setor está 100% no total', () => {
    expect(isBelowDailyProgramming({
      setor: 'BOBINA AT', programado: 80, produzido: 80,
      linhas: [
        { linha: 'MON', programado: 40, produzido: 50, potencias: [] },
        { linha: 'TRI', programado: 40, produzido: 30, potencias: [] },
      ],
    })).toBe(true);
  });

  it('não marca linha sem programação, nem compensa falta de outra linha', () => {
    expect(isBelowDailyProgramming({
      setor: 'EPOXI', programado: 0, produzido: 10,
      linhas: [{ linha: 'EPO', programado: 0, produzido: 10, potencias: [] }],
    })).toBe(false);
    expect(isBelowDailyProgramming({
      setor: 'SOLDA', programado: 20, produzido: 22,
      linhas: [
        { linha: 'MON', programado: 10, produzido: 12, potencias: [] },
        { linha: 'TRI', programado: 10, produzido: 10, potencias: [] },
      ],
    })).toBe(false);
    expect(isBelowDailyProgramming({
      setor: 'BOBINA BT', programado: 20, produzido: 0,
      linhas: [{ linha: 'MON', programado: 20, produzido: 0, potencias: [] }],
    })).toBe(true);
  });

  it('mantém compatibilidade com respostas que ainda não incluem linhas', () => {
    expect(isBelowDailyProgramming({ setor: 'TESTE', programado: 20, produzido: 15 })).toBe(true);
    expect(isBelowDailyProgramming({ setor: 'TESTE', programado: 20, produzido: 22 })).toBe(false);
  });

  it('retorna totais seguros para um período sem dados', () => {
    expect(buildDailyProductionMetrics([])).toEqual({
      setores: [],
      totais: { programado: 0, produzido: 0, aderencia: null },
    });
  });
});
