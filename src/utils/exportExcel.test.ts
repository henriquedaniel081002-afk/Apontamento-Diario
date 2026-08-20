import { describe, expect, it } from 'vitest';
import type { Apontamento } from '../types';
import { buildApontamentosWorkbookData } from './exportExcel';

const apontamento: Apontamento = {
  id: '42',
  data: '2026-08-13',
  setor: 'BOBINA AT',
  tipoBobina: 'AT',
  userId: '1',
  userName: 'Bobinagem',
  linhasPermitidas: ['MON', 'TRI'],
  producoes: [
    { id: 'p1', linha: 'MON', potencia: 112.5, quantidade: 8 },
  ],
  faltas: [
    {
      id: 'f1',
      linha: 'TRI',
      turno: '2º turno',
      quantidade: 1,
      justificativa: 'Atestado médico',
    },
  ],
  observacoes: [
    {
      id: 'o1',
      linha: 'MON',
      turno: '1º turno',
      observacao: 'Parada programada',
    },
  ],
  createdAt: '2026-08-13T12:00:00.000Z',
  updatedAt: '2026-08-13T12:30:00.000Z',
  statusAprovacao: 'APROVADO',
};

describe('estrutura da exportação Excel', () => {
  it('mantém as três coleções e inclui justificativas na aba de observações', () => {
    const workbook = buildApontamentosWorkbookData([apontamento]);

    expect(workbook.produzido).toEqual([
      { data: '13/ago', potencia: 112.5, qtde: 8, setor: 'BOBINA AT', linha: 'MON', status: 'APROVADO' },
    ]);
    expect(workbook.faltas).toEqual([
      { data: '13/ago', faltas: 1, turno: 2, setor: 'BOBINA AT', linha: 'TRI', status: 'APROVADO' },
    ]);
    expect(workbook.obs).toEqual([
      { data: '13/ago', obs: 'Parada programada', setor: 'BOBINA AT', linha: 'MON', status: 'APROVADO' },
      { data: '13/ago', obs: 'Atestado médico', setor: 'BOBINA AT', linha: 'TRI', status: 'APROVADO' },
    ]);
  });

  it('exporta como PENDENTE quando o status não vier preenchido', () => {
    const semStatus = { ...apontamento, statusAprovacao: undefined };
    const workbook = buildApontamentosWorkbookData([semStatus]);

    expect(workbook.produzido[0].status).toBe('PENDENTE');
    expect(workbook.faltas[0].status).toBe('PENDENTE');
    expect(workbook.obs[0].status).toBe('PENDENTE');
  });

  it('continua impedindo exportação sem registros', () => {
    expect(() => buildApontamentosWorkbookData([])).toThrow('Não há registros para exportar.');
  });
});
