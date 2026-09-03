import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAderenciaAnualWorkbook } from './parseAderenciaAnualExcel';

function workbookFile(rows: unknown[][], sheetName = 'Aderência Anual'): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return {
    name: 'aderencia.xlsx',
    arrayBuffer: async () => bytes,
  } as File;
}

describe('importação do Excel de Aderência Anual', () => {
  it('localiza a aba e normaliza cabeçalhos, meses e números pt-BR', async () => {
    const result = await parseAderenciaAnualWorkbook(workbookFile([
      ['Relatório anual'],
      ['mês', 'PROGRAMADO', 'Realizado', 'Dias úteis'],
      ['Janeiro de 2024', '1.250', '1.100', 21],
      ['02/2025', 2000, '1.999,5', '20'],
      [null, null, null, null],
    ], 'ADERENCIA ANUAL'));

    expect(result.payload).toEqual([
      { mes: '2024-01-01', programado: 1250, realizado: 1100, dias_uteis: 21 },
      { mes: '2025-02-01', programado: 2000, realizado: 1999.5, dias_uteis: 20 },
    ]);
    expect(result.years).toEqual([2024, 2025]);
  });

  it('rejeita meses duplicados no mesmo arquivo', async () => {
    const file = workbookFile([
      ['MÊS', 'PROGRAMADO', 'REALIZADO', 'DIAS ÚTEIS'],
      ['2026-08-01', 100, 90, 21],
      ['Agosto de 2026', 110, 95, 21],
    ]);

    await expect(parseAderenciaAnualWorkbook(file)).rejects.toThrow(/duplicado/i);
  });

  it('não converte erros de fórmula em números silenciosamente', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['MÊS', 'PROGRAMADO', 'REALIZADO', 'DIAS ÚTEIS'],
      ['2026-08-01', 100, 90, 21],
    ]);
    worksheet.B2 = { t: 'e', v: 7, w: '#DIV/0!' };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Aderência Anual');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = { name: 'formula.xlsm', arrayBuffer: async () => bytes } as File;

    await expect(parseAderenciaAnualWorkbook(file)).rejects.toThrow(/erro de fórmula/i);
  });

  it('rejeita arquivo que não contém ano no campo MÊS', async () => {
    const file = workbookFile([
      ['MÊS', 'PROGRAMADO', 'REALIZADO', 'DIAS ÚTEIS'],
      ['Janeiro', 100, 90, 21],
    ]);

    await expect(parseAderenciaAnualWorkbook(file)).rejects.toThrow(/mês e ano/i);
  });
});
