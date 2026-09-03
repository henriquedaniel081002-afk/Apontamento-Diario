import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAtrasoWorkbook } from './importAtrasoExcel';

function createWorkbookFile(setores: string[]): File {
  const rows = setores.map((setor, index) => ({
    'SÉRIE': 1000 + index,
    'POTÊNCIA': 75,
    'LINHA': 'TRI',
    'OP': 2000 + index,
    'CLIENTE': `Cliente ${index + 1}`,
    'DATA PROG.': '03/09/2026',
    'SETOR': setor,
    'STATUS': 'ATRASO',
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'ANÁLISE DE ATRASOS');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return {
    name: 'BASE ATRASO.xlsx',
    arrayBuffer: async () => bytes,
  } as File;
}

describe('parseAtrasoWorkbook', () => {
  it('ignora Laboratório com variações de capitalização e espaços sem afetar outros setores', async () => {
    const preview = await parseAtrasoWorkbook(createWorkbookFile([
      'LABORATÓRIO',
      'Laboratório',
      ' laboratório ',
      'PINTURA',
    ]));

    expect(preview.payload).toHaveLength(1);
    expect(preview.payload[0].setor).toBe('PINTURA');
    expect(preview.atrasoRows).toBe(1);
    expect(preview.ignoredRows).toBe(3);
  });
});
