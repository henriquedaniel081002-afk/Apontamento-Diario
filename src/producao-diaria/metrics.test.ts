import { describe, expect, it } from 'vitest';
import { buildDailyProductionMetrics, calculateAdherence } from './metrics';

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

  it('retorna totais seguros para um período sem dados', () => {
    expect(buildDailyProductionMetrics([])).toEqual({
      setores: [],
      totais: { programado: 0, produzido: 0, aderencia: null },
    });
  });
});
