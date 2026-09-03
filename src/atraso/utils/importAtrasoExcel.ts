import * as XLSX from 'xlsx';
import type { AtrasoImportPreview, AtrasoRecord, AtrasoStatus } from '../types';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function rowMap(row: Record<string, unknown>) {
  return new Map(Object.entries(row).map(([key, value]) => [normalizeText(key), value]));
}

function getValue(map: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = map.get(normalizeText(alias));
    if (value !== undefined) return value;
  }
  return undefined;
}

function toInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  const text = String(value).trim().replace(/\s+/g, '');
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : /^[+-]?\d{1,3}(?:\.\d{3})+$/.test(text)
      ? text.replace(/\./g, '')
      : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateISO(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }

  const text = String(value).trim();
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function statusValue(value: unknown): AtrasoStatus | null {
  const normalized = normalizeText(value);
  if (normalized === 'ATRASO') return 'ATRASO';
  if (normalized === 'ADIANTAMENTO' || normalized === 'ADIANTADO') return 'ADIANTAMENTO';
  return null;
}

function findSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const preferredName = workbook.SheetNames.find((name) => normalizeText(name) === 'ANALISE DE ATRASOS');
  if (preferredName) return workbook.Sheets[preferredName];
  return workbook.Sheets[workbook.SheetNames[0]];
}

export async function parseAtrasoWorkbook(file: File): Promise<AtrasoImportPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (!workbook.SheetNames.length) throw new Error('O Excel não possui nenhuma planilha legível.');

  const sheet = findSheet(workbook);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  if (!rows.length) throw new Error('A planilha de análise de atrasos está vazia.');

  const firstMap = rowMap(rows[0]);
  const requiredHeaders = [
    ['SÉRIE', 'SERIE'],
    ['POTÊNCIA', 'POTENCIA'],
    ['LINHA'],
    ['OP'],
    ['CLIENTE'],
    ['DATA PROG.', 'DATA PROG', 'DATA PROGRAMADA'],
    ['SETOR'],
    ['STATUS'],
  ];
  const missing = requiredHeaders
    .filter((aliases) => aliases.every((alias) => !firstMap.has(normalizeText(alias))))
    .map((aliases) => aliases[0]);
  if (missing.length) {
    throw new Error(`O Excel não possui as colunas obrigatórias: ${missing.join(', ')}.`);
  }

  const payload: AtrasoRecord[] = [];
  let atrasoRows = 0;
  let adiantamentoRows = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const map = rowMap(rows[index]);
    const status = statusValue(getValue(map, ['STATUS']));
    if (!status) continue;

    const serie = toInteger(getValue(map, ['SÉRIE', 'SERIE']));
    const dataProgramada = toDateISO(getValue(map, ['DATA PROG.', 'DATA PROG', 'DATA PROGRAMADA']));
    const linha = String(getValue(map, ['LINHA']) ?? '').trim();
    const setor = String(getValue(map, ['SETOR']) ?? '').trim();

    if (normalizeText(setor) === 'LABORATORIO') continue;

    if (serie === null || !dataProgramada || !linha || !setor) {
      throw new Error(`Linha ${index + 2}: registro de ${status === 'ATRASO' ? 'atraso' : 'adiantamento'} sem série, data programada, linha ou setor válido.`);
    }

    const record: AtrasoRecord = {
      serie,
      potencia: toNumber(getValue(map, ['POTÊNCIA', 'POTENCIA'])),
      linha,
      op: toInteger(getValue(map, ['OP'])),
      cliente: String(getValue(map, ['CLIENTE']) ?? '').trim(),
      data_programada: dataProgramada,
      setor,
      status,
    };

    payload.push(record);
    if (status === 'ATRASO') atrasoRows += 1;
    else adiantamentoRows += 1;
  }

  if (!payload.length) {
    throw new Error('Nenhum registro com status ATRASO ou ADIANTAMENTO foi encontrado no arquivo.');
  }

  return {
    fileName: file.name,
    totalSourceRows: rows.length,
    atrasoRows,
    adiantamentoRows,
    ignoredRows: rows.length - payload.length,
    payload,
  };
}
