import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { readProductionImportExcelMonth } from './importProductionExcel';

describe('leitura integral da planilha de produção', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lê somente o mês pedido e preserva turnos, setores e valores ignorados', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const book = XLSX.utils.book_new();
    const rows = [
      ['OUTRA', 'DATA PRODUZIDA', 'SETOR', 'POTÊNCIA', 'TURNO', 'LINHA', 'IGNORADA'],
      ['texto & <valor>', '2026-10-05', 'SOLDA', 75, '1º', 'MON', 'não usada'],
      ['x', '2026-10-05', 'SOLDA', 75, '2º', 'MON', 'não usada'],
      ['x', '2026-10-06', 'MONTAGEM FINAL', 150, '1º', 'EPO', 'não usada'],
      ['x', '2026-10-06', 'SOLDA', '', '1º', 'MON', 'não usada'],
      ['x', '2026-09-06', 'SOLDA', 75, '1º', 'MON', 'não usada'],
    ];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Apontamento Final');
    const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'buffer', compression: false });
    const file = new NodeFile([bytes], 'producao.xlsx') as unknown as File;
    const result = await readProductionImportExcelMonth(file, '2026-10');
    expect(result.rowsMatched).toBe(4);
    expect(result.ignoredWithoutPower).toBe(1);
    expect(result.dias).toHaveLength(2);
    expect(result.dias[0].validGroups).toEqual([
      { setor: 'SOLDA', tipoBobina: undefined, linha: 'MON', turno: '1º', potencia: 75, quantidade: 1 },
      { setor: 'SOLDA', tipoBobina: undefined, linha: 'MON', turno: '2º', potencia: 75, quantidade: 1 },
    ]);
    expect(result.dias[1].validGroups).toEqual([{ setor: 'EPOXI', linha: 'EPO', turno: '1º', potencia: 150, quantidade: 1 }]);
  });
});
