import { describe, expect, it } from 'vitest';
import type { Apontamento } from '../types';
import {
  OPERATIONAL_UNITS,
  filterCoordinationApontamentos,
  filterHistoryApontamentos,
  getOperationalStatus,
  getPreviousWorkingDayYmd,
  matchesHistoryPeriod,
} from './operational';

function makeApontamento(overrides: Partial<Apontamento> = {}): Apontamento {
  return {
    id: '1',
    data: '2026-08-13',
    setor: 'PINTURA',
    userId: 'user-1',
    userName: 'Pintura',
    linhasPermitidas: ['MON', 'TRI'],
    producoes: [],
    faltas: [],
    observacoes: [],
    createdAt: '2026-08-13T12:00:00.000Z',
    updatedAt: '2026-08-13T12:00:00.000Z',
    ...overrides,
  };
}

describe('último dia útil anterior', () => {
  it.each([
    ['segunda-feira', '2026-08-17T12:00:00', '2026-08-14'],
    ['terça-feira', '2026-08-18T12:00:00', '2026-08-17'],
    ['sexta-feira', '2026-08-21T12:00:00', '2026-08-20'],
    ['sábado', '2026-08-15T12:00:00', '2026-08-14'],
    ['domingo', '2026-08-16T12:00:00', '2026-08-14'],
  ])('%s retorna %s', (_label, reference, expected) => {
    expect(getPreviousWorkingDayYmd(new Date(reference))).toBe(expected);
  });
});

describe('unidades operacionais', () => {
  it('mantém exatamente doze unidades e todas as divisões críticas', () => {
    expect(OPERATIONAL_UNITS).toHaveLength(12);
    expect(OPERATIONAL_UNITS.map((unit) => unit.id)).toEqual(expect.arrayContaining([
      'BOBINA AT',
      'BOBINA BT',
      'MONTAGEM FINAL MON',
      'MONTAGEM FINAL TRI',
      'MPA MON',
      'MPA TRI',
    ]));
  });

  it('não agrega Bobina AT e BT', () => {
    const status = getOperationalStatus([
      makeApontamento({ setor: 'BOBINA AT', tipoBobina: 'AT' }),
    ], '2026-08-13');

    expect(status.pendingUnits.map((unit) => unit.id)).not.toContain('BOBINA AT');
    expect(status.pendingUnits.map((unit) => unit.id)).toContain('BOBINA BT');
  });

  it('reconhece apontamento vazio de MON por linhasPermitidas sem concluir TRI', () => {
    const status = getOperationalStatus([
      makeApontamento({
        setor: 'MONTAGEM FINAL',
        userName: 'Montagem Final MON',
        linhasPermitidas: ['MON'],
      }),
    ], '2026-08-13');

    expect(status.pendingUnits.map((unit) => unit.id)).not.toContain('MONTAGEM FINAL MON');
    expect(status.pendingUnits.map((unit) => unit.id)).toContain('MONTAGEM FINAL TRI');
  });

  it('não considera ocorrência antecipada como produção reportada antes da importação', () => {
    const status = getOperationalStatus([
      makeApontamento({
        setor: 'PINTURA',
        origemProducao: 'IMPORTADO',
        complementado: true,
        producoes: [],
        observacoes: [{ id: 'obs-pre', observacao: 'Registro antecipado' }],
      }),
    ], '2026-08-13');

    expect(status.pendingUnits.map((unit) => unit.id)).toContain('PINTURA');
  });

  it('não considera produção importada como apontada antes do complemento', () => {
    const status = getOperationalStatus([
      makeApontamento({
        setor: 'SOLDA',
        origemProducao: 'IMPORTADO',
        complementado: false,
        producoes: [{ id: 'p1', linha: 'TRI', potencia: 150, quantidade: 12 }],
      }),
    ], '2026-08-13');

    expect(status.pendingUnits.map((unit) => unit.id)).toContain('SOLDA');
  });

  it('usa somente a data selecionada para calcular pendências', () => {
    const status = getOperationalStatus([
      makeApontamento({ data: '2026-08-12', setor: 'PINTURA' }),
    ], '2026-08-13');

    expect(status.records).toBe(0);
    expect(status.completedUnits).toBe(0);
    expect(status.pendingUnits).toHaveLength(12);
  });
});

describe('filtros preservados', () => {
  it('caracteriza a fronteira atual de Últimos 7 dias sem criar regra nova', () => {
    const reference = new Date('2026-08-14T15:00:00');
    expect(matchesHistoryPeriod('2026-08-07', '7DAYS', reference)).toBe(false);
    expect(matchesHistoryPeriod('2026-08-08', '7DAYS', reference)).toBe(true);
  });

  it('filtra o histórico por uma data exata quando o filtro de data está preenchido', () => {
    const records = [
      makeApontamento({ id: '1', data: '2026-08-13' }),
      makeApontamento({ id: '2', data: '2026-08-14' }),
    ];

    expect(filterHistoryApontamentos(records, {
      data: '2026-08-14',
      linha: 'ALL',
      period: 'ALL',
      search: '',
    })).toEqual([expect.objectContaining({ id: '2' })]);
  });

  it('exige potência e linha no mesmo item quando ambos os filtros estão ativos', () => {
    const record = makeApontamento({
      producoes: [
        { id: 'p1', linha: 'MON', potencia: 75, quantidade: 1 },
        { id: 'p2', linha: 'TRI', potencia: 150, quantidade: 1 },
      ],
    });

    expect(filterCoordinationApontamentos([record], {
      data: '2026-08-13',
      setor: 'ALL',
      linha: 'MON',
      potencia: '150',
    })).toHaveLength(0);
  });
});
