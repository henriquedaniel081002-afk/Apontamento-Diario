import * as XLSX from 'xlsx';
import type { AderenciaAnualImportPreview, AderenciaAnualUpsertRow } from '../types';

const TARGET_SHEET = 'ADERENCIA ANUAL';
const FORMULA_ERROR = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA)$/i;
const REQUIRED_HEADERS = ['MES', 'PROGRAMADO', 'REALIZADO', 'DIASUTEIS'] as const;
type RequiredHeader = typeof REQUIRED_HEADERS[number];

const MONTHS: Record<string, number> = {
  JANEIRO: 1,
  JAN: 1,
  FEVEREIRO: 2,
  FEV: 2,
  MARCO: 3,
  MAR: 3,
  ABRIL: 4,
  ABR: 4,
  MAIO: 5,
  MAI: 5,
  JUNHO: 6,
  JUN: 6,
  JULHO: 7,
  JUL: 7,
  AGOSTO: 8,
  AGO: 8,
  SETEMBRO: 9,
  SET: 9,
  OUTUBRO: 10,
  OUT: 10,
  NOVEMBRO: 11,
  NOV: 11,
  DEZEMBRO: 12,
  DEZ: 12,
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value).replace(/\s/g, '');
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

function assertValidYear(year: number, rowNumber: number): void {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error(`Linha ${rowNumber}: o ano do campo MÊS é inválido.`);
  }
}

function toMonthDate(year: number, month: number, rowNumber: number): string {
  assertValidYear(year, rowNumber);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Linha ${rowNumber}: o mês informado é inválido.`);
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

function parseMonth(value: unknown, rowNumber: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toMonthDate(value.getFullYear(), value.getMonth() + 1, rowNumber);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return toMonthDate(parsed.y, parsed.m, rowNumber);
  }

  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`Linha ${rowNumber}: informe MÊS com mês e ano.`);
  if (FORMULA_ERROR.test(raw)) throw new Error(`Linha ${rowNumber}: MÊS contém um erro de fórmula (${raw}).`);

  let match = /^(\d{4})[-\/.](\d{1,2})(?:[-\/\.](\d{1,2}))?$/.exec(raw);
  if (match) return toMonthDate(Number(match[1]), Number(match[2]), rowNumber);

  match = /^(\d{1,2})[-\/.](\d{4})$/.exec(raw);
  if (match) return toMonthDate(Number(match[2]), Number(match[1]), rowNumber);

  match = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(raw);
  if (match) return toMonthDate(Number(match[3]), Number(match[2]), rowNumber);

  const normalized = normalizeText(raw);
  const yearMatch = /(?:^| )(\d{4})(?: |$)/.exec(normalized);
  const monthToken = normalized.split(' ').find((token) => MONTHS[token] !== undefined);
  if (yearMatch && monthToken) {
    return toMonthDate(Number(yearMatch[1]), MONTHS[monthToken], rowNumber);
  }

  throw new Error(`Linha ${rowNumber}: não foi possível identificar mês e ano em "${raw}".`);
}

function parseNumber(value: unknown, field: string, rowNumber: number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Linha ${rowNumber}: ${field} não é um número válido.`);
    if (value < 0) throw new Error(`Linha ${rowNumber}: ${field} não pode ser negativo.`);
    return value;
  }

  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`Linha ${rowNumber}: informe ${field}.`);
  if (FORMULA_ERROR.test(raw)) throw new Error(`Linha ${rowNumber}: ${field} contém um erro de fórmula (${raw}).`);

  let normalized = raw.replace(/\s/g, '').replace(/^R\$/i, '').replace(/%$/, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasDot && /^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Linha ${rowNumber}: ${field} não é um número válido.`);
  if (parsed < 0) throw new Error(`Linha ${rowNumber}: ${field} não pode ser negativo.`);
  return parsed;
}

function findHeaderRow(rows: unknown[][]): { index: number; columns: Record<RequiredHeader, number> } {
  const limit = Math.min(rows.length, 50);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const columns = {} as Record<RequiredHeader, number>;
    rows[rowIndex].forEach((value, columnIndex) => {
      const normalized = normalizeHeader(value);
      if (REQUIRED_HEADERS.includes(normalized as RequiredHeader)) {
        const header = normalized as RequiredHeader;
        if (columns[header] === undefined) columns[header] = columnIndex;
      }
    });

    if (REQUIRED_HEADERS.every((header) => columns[header] !== undefined)) {
      return { index: rowIndex, columns };
    }
  }

  throw new Error('Não foi possível localizar os cabeçalhos MÊS, PROGRAMADO, REALIZADO e DIAS ÚTEIS.');
}

function assertCellHasNoFormulaError(
  worksheet: XLSX.WorkSheet,
  range: XLSX.Range,
  rowIndex: number,
  columnIndex: number,
  field: string,
): void {
  const cellAddress = XLSX.utils.encode_cell({
    r: range.s.r + rowIndex,
    c: range.s.c + columnIndex,
  });
  const cell = worksheet[cellAddress];
  if (cell?.t === 'e') {
    throw new Error(`Linha ${range.s.r + rowIndex + 1}: ${field} contém um erro de fórmula.`);
  }
}

export async function parseAderenciaAnualWorkbook(file: File): Promise<AderenciaAnualImportPreview> {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('pt-BR');
  if (!extension || !['xlsx', 'xlsm', 'xls'].includes(extension)) {
    throw new Error('Selecione um arquivo Excel nos formatos .xlsx, .xlsm ou .xls.');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  } catch {
    throw new Error('Não foi possível abrir o arquivo Excel. Verifique se ele não está corrompido.');
  }

  const sheetName = workbook.SheetNames.find((name) => normalizeText(name) === TARGET_SHEET);
  if (!sheetName) throw new Error('A aba "Aderência Anual" não foi encontrada no arquivo.');

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet?.['!ref']) throw new Error('A aba "Aderência Anual" está vazia.');

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  });
  const header = findHeaderRow(rows);
  const payload: AderenciaAnualUpsertRow[] = [];
  const importedMonths = new Map<string, number>();

  for (let rowIndex = header.index + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const values = REQUIRED_HEADERS.map((field) => row[header.columns[field]]);
    if (values.every(isBlank)) continue;

    const spreadsheetRow = range.s.r + rowIndex + 1;
    for (const field of REQUIRED_HEADERS) {
      assertCellHasNoFormulaError(worksheet, range, rowIndex, header.columns[field], field);
    }

    const mes = parseMonth(row[header.columns.MES], spreadsheetRow);
    const duplicateRow = importedMonths.get(mes);
    if (duplicateRow !== undefined) {
      throw new Error(`Linhas ${duplicateRow} e ${spreadsheetRow}: o mês ${mes.slice(0, 7)} está duplicado no arquivo.`);
    }

    const programado = parseNumber(row[header.columns.PROGRAMADO], 'PROGRAMADO', spreadsheetRow);
    const realizado = parseNumber(row[header.columns.REALIZADO], 'REALIZADO', spreadsheetRow);
    const diasUteis = parseNumber(row[header.columns.DIASUTEIS], 'DIAS ÚTEIS', spreadsheetRow);
    if (!Number.isInteger(diasUteis) || diasUteis > 31) {
      throw new Error(`Linha ${spreadsheetRow}: DIAS ÚTEIS deve ser um número inteiro entre 0 e 31.`);
    }

    importedMonths.set(mes, spreadsheetRow);
    payload.push({ mes, programado, realizado, dias_uteis: diasUteis });
  }

  if (payload.length === 0) throw new Error('A aba "Aderência Anual" não possui linhas válidas para importar.');
  payload.sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    payload,
    years: Array.from(new Set(payload.map((row) => Number(row.mes.slice(0, 4))))).sort((a, b) => a - b),
    firstMonth: payload[0].mes,
    lastMonth: payload[payload.length - 1].mes,
  };
}
