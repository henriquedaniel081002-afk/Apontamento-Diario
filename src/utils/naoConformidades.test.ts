import { describe, expect, it } from 'vitest';
import type { NaoConformidadeDashboardItem } from '../types/naoConformidades';
import { calcularIndicadoresNC, tempoNaoConformidade } from './naoConformidades';

describe('Tempo de Não Conformidades', () => {
  const criadoEm = '2026-10-01T12:00:00Z';
  it.each([[0, '< 1min'], [5, '5min'], [300, '5h'], [1680, '1d 4h'], [4320, '3d']])('formata %s minutos como %s', (minutes, expected) => {
    expect(tempoNaoConformidade({ criadoEm, statusReparo: 'AGUARDANDO_REPARO' }, Date.parse(criadoEm) + minutes * 60_000)).toBe(expected);
  });
  it('encerra a contagem na data do reparo, independentemente de agora', () => {
    expect(tempoNaoConformidade({ criadoEm, statusReparo: 'REPARADO', reparadoEm: '2026-10-02T16:00:00Z' }, Date.parse('2026-12-01'))).toBe('1d 4h');
  });
  it('datas ausentes, inválidas ou invertidas têm fallback', () => {
    expect(tempoNaoConformidade({ criadoEm: '', statusReparo: 'AGUARDANDO_REPARO' })).toBe('—');
    expect(tempoNaoConformidade({ criadoEm, statusReparo: 'REPARADO' })).toBe('—');
    expect(tempoNaoConformidade({ criadoEm, statusReparo: 'REPARADO', reparadoEm: '2026-09-01' })).toBe('—');
  });
});

describe('Indicadores dos registros filtrados', () => {
  it('calcula total, status, percentual e ordenação por setor real', () => {
    const items = [
      { setorId: '1', setor: 'SOLDA', statusReparo: 'REPARADO' },
      { setorId: '2', setor: 'PINTURA', statusReparo: 'AGUARDANDO_REPARO' },
      { setorId: '1', setor: 'SOLDA', statusReparo: 'AGUARDANDO_REPARO' },
    ] as NaoConformidadeDashboardItem[];
    const result = calcularIndicadoresNC(items);
    expect(result.percentualReparadas).toBeCloseTo(100 / 3);
    expect(result).toMatchObject({ total: 3, reparadas: 1, aguardando: 2,
      porSetor: [{ setor: 'SOLDA', quantidade: 2 }, { setor: 'PINTURA', quantidade: 1 }] });
  });
  it('sem registros retorna 0%, sem divisão por zero', () => {
    expect(calcularIndicadoresNC([])).toEqual({ total: 0, reparadas: 0, aguardando: 0, percentualReparadas: 0, porSetor: [] });
  });
});
