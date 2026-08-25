import { Linha, ProductionImportGroup, ProductionTurno, Setor, TipoBobina } from '../types';

export interface RawProductionGroup {
  id: string;
  setorOriginal: string;
  linhaOriginal: string;
  turno?: ProductionTurno;
  potencia: number;
  quantidade: number;
}

export interface ProductionImportIssue extends RawProductionGroup {
  kind: 'LINHA' | 'SETOR';
  allowedLines: Linha[];
  message: string;
}

export interface ProductionImportPreview {
  fileName: string;
  data: string;
  rowsProcessed: number;
  rowsMatched: number;
  ignoredWithoutPower: number;
  validGroups: ProductionImportGroup[];
  issues: ProductionImportIssue[];
}

export interface ProductionMonthImportPreview {
  fileName: string;
  mesReferencia: string;
  rowsProcessed: number;
  rowsMatched: number;
  ignoredWithoutPower: number;
  dias: ProductionImportPreview[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface SectorRule {
  setor: Setor;
  tipoBobina?: TipoBobina;
  allowedLines: Linha[];
}

const textDecoder = new TextDecoder('utf-8');

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeProductionTurno(value: unknown): ProductionTurno | null {
  const raw = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*turno\s*$/i, '')
    .trim();

  if (/^(1|1[º°o]|primeiro)$/.test(raw)) return '1º';
  if (/^(2|2[º°o]|segundo)$/.test(raw)) return '2º';
  return null;
}

function sectorRule(rawSector: string): SectorRule | null {
  const sector = normalizeText(rawSector);
  const rules: Record<string, SectorRule> = {
    'BOBINA AT': { setor: 'BOBINA AT/BT', tipoBobina: 'AT', allowedLines: ['MON', 'TRI', 'EPO'] },
    'BOBINA BT': { setor: 'BOBINA AT/BT', tipoBobina: 'BT', allowedLines: ['MON', 'TRI', 'EPO'] },
    'CORTE DO LASER': { setor: 'CORTE LASER', allowedLines: ['MON', 'TRI', 'EPO'] },
    'CORTE LASER': { setor: 'CORTE LASER', allowedLines: ['MON', 'TRI', 'EPO'] },
    'CORTE DO NUCLEO': { setor: 'CORTE DO NUCLEO', allowedLines: ['MON', 'TRI', 'EPO'] },
    'CORTE NUCLEO': { setor: 'CORTE DO NUCLEO', allowedLines: ['MON', 'TRI', 'EPO'] },
    'FERRAGEM': { setor: 'FERRAGEM', allowedLines: ['MON', 'TRI', 'EPO'] },
    'FERRAGEM PA': { setor: 'FERRAGEM', allowedLines: ['MON', 'TRI', 'EPO'] },
    'FERRAGEM PA / ACESSORIOS': { setor: 'FERRAGEM', allowedLines: ['MON', 'TRI', 'EPO'] },
    'FERRAGEM PA/ACESSORIOS': { setor: 'FERRAGEM', allowedLines: ['MON', 'TRI', 'EPO'] },
    'ISOLANTE': { setor: 'ISOLANTE', allowedLines: ['MON', 'TRI', 'EPO'] },
    'MONTAGEM DO NUCLEO': { setor: 'MONTAGEM NUCLEO', allowedLines: ['MON', 'TRI', 'EPO'] },
    'MONTAGEM NUCLEO': { setor: 'MONTAGEM NUCLEO', allowedLines: ['MON', 'TRI', 'EPO'] },
    'MONTAGEM FINAL': { setor: 'MONTAGEM FINAL', allowedLines: ['MON', 'TRI', 'EPO'] },
    'MPA': { setor: 'MPA', allowedLines: ['MON', 'TRI', 'EPO'] },
    'PINTURA': { setor: 'PINTURA', allowedLines: ['MON', 'TRI', 'EPO'] },
    'SOLDA': { setor: 'SOLDA', allowedLines: ['MON', 'TRI', 'EPO'] },
  };
  return rules[sector] || null;
}

function importKey(group: ProductionImportGroup): string {
  return [group.setor, group.tipoBobina || '', group.linha, Number(group.potencia), group.turno || ''].join('|');
}

function aggregateImportGroups(groups: ProductionImportGroup[]): ProductionImportGroup[] {
  const map = new Map<string, ProductionImportGroup>();
  for (const group of groups) {
    const key = importKey(group);
    const current = map.get(key);
    if (current) current.quantidade += group.quantidade;
    else map.set(key, { ...group });
  }
  return [...map.values()].sort((a, b) =>
    String(a.setor).localeCompare(String(b.setor), 'pt-BR')
    || String(a.tipoBobina || '').localeCompare(String(b.tipoBobina || ''), 'pt-BR')
    || String(a.linha).localeCompare(String(b.linha), 'pt-BR')
    || a.potencia - b.potencia
    || String(a.turno || '').localeCompare(String(b.turno || ''), 'pt-BR'),
  );
}

export function classifyRawProductionGroup(group: RawProductionGroup):
  | { group: ProductionImportGroup; issue?: never }
  | { group?: never; issue: ProductionImportIssue } {
  const rawLine = normalizeText(group.linhaOriginal);

  // MONTAGEM FINAL + EPO continua direcionado ao apontador específico de Epóxi.
  // Nos demais setores, EPO é uma linha válida e permanece EPO, sem conversão para TRI.
  if (normalizeText(group.setorOriginal) === 'MONTAGEM FINAL' && rawLine === 'EPO') {
    return {
      group: {
        setor: 'EPOXI',
        linha: 'EPO',
        ...(group.turno ? { turno: group.turno } : {}),
        potencia: group.potencia,
        quantidade: group.quantidade,
      },
    };
  }

  const rule = sectorRule(group.setorOriginal);
  if (!rule) {
    return {
      issue: {
        ...group,
        kind: 'SETOR',
        allowedLines: [],
        message: `O setor “${group.setorOriginal}” não possui apontador correspondente no sistema e será ignorado.`,
      },
    };
  }

  if (!rule.allowedLines.includes(rawLine as Linha)) {
    return {
      issue: {
        ...group,
        kind: 'LINHA',
        allowedLines: rule.allowedLines,
        message: `A linha “${group.linhaOriginal}” precisa ser corrigida antes da importação.`,
      },
    };
  }

  return {
    group: {
      setor: rule.setor,
      tipoBobina: rule.tipoBobina,
      linha: rawLine as Linha,
      ...(group.turno ? { turno: group.turno } : {}),
      potencia: group.potencia,
      quantidade: group.quantidade,
    },
  };
}

export function buildFinalImportGroups(
  preview: ProductionImportPreview,
  corrections: Record<string, Linha | undefined>,
): ProductionImportGroup[] {
  const corrected: ProductionImportGroup[] = [...preview.validGroups];

  for (const issue of preview.issues) {
    if (issue.kind !== 'LINHA') continue;
    const selectedLine = corrections[issue.id];
    if (!selectedLine || !issue.allowedLines.includes(selectedLine)) continue;

    const rule = sectorRule(issue.setorOriginal);
    if (!rule) continue;
    corrected.push({
      setor: rule.setor,
      tipoBobina: rule.tipoBobina,
      linha: selectedLine,
      ...(issue.turno ? { turno: issue.turno } : {}),
      potencia: issue.potencia,
      quantidade: issue.quantidade,
    });
  }

  return aggregateImportGroups(corrected);
}

export function getUnresolvedLineIssues(
  preview: ProductionImportPreview,
  corrections: Record<string, Linha | undefined>,
): ProductionImportIssue[] {
  return preview.issues.filter((issue) => issue.kind === 'LINHA' && !corrections[issue.id]);
}

function parseZipEntries(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo inválido: estrutura ZIP do Excel não encontrada.');

  const entriesCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entriesCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Arquivo Excel inválido: diretório interno corrompido.');
    }
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    entries.set(name, { name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function getCompressedEntryBytes(buffer: ArrayBuffer, entry: ZipEntry): Uint8Array {
  const view = new DataView(buffer);
  if (view.getUint32(entry.localHeaderOffset, true) !== 0x04034b50) {
    throw new Error(`Entrada interna inválida: ${entry.name}.`);
  }
  const fileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  return new Uint8Array(buffer, dataOffset, entry.compressedSize);
}

async function entryByteStream(buffer: ArrayBuffer, entry: ZipEntry): Promise<ReadableStream<Uint8Array>> {
  const bytes = getCompressedEntryBytes(buffer, entry);
  const source = new Blob([bytes]).stream();
  if (entry.compressionMethod === 0) return source;
  if (entry.compressionMethod !== 8) {
    throw new Error(`Formato de compactação não suportado no Excel (${entry.compressionMethod}).`);
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não oferece o recurso necessário para ler o Excel. Atualize o Chrome/Edge e tente novamente.');
  }
  return source.pipeThrough(new DecompressionStream('deflate-raw'));
}

async function readEntryText(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const stream = await entryByteStream(buffer, entry);
  return new Response(stream).text();
}

function xmlDocument(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Não foi possível interpretar a estrutura interna do Excel.');
  return doc;
}

function resolveSheetPath(workbookXml: string, relsXml: string, sheetName: string): string {
  const workbook = xmlDocument(workbookXml);
  const sheet = [...workbook.getElementsByTagName('sheet')]
    .find((item) => item.getAttribute('name') === sheetName);
  if (!sheet) throw new Error(`A aba “${sheetName}” não foi encontrada no arquivo.`);
  const relationshipId = sheet.getAttribute('r:id')
    || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  if (!relationshipId) throw new Error(`Não foi possível localizar a aba “${sheetName}”.`);

  const rels = xmlDocument(relsXml);
  const relation = [...rels.getElementsByTagName('Relationship')]
    .find((item) => item.getAttribute('Id') === relationshipId);
  const target = relation?.getAttribute('Target');
  if (!target) throw new Error(`A referência interna da aba “${sheetName}” está ausente.`);

  const normalized = target.replace(/^\/+/, '');
  if (normalized.startsWith('xl/')) return normalized;
  if (normalized.startsWith('../')) return normalized.replace(/^\.\.\//, '');
  return `xl/${normalized}`;
}

function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const doc = xmlDocument(xml);
  return [...doc.getElementsByTagName('si')].map((item) => item.textContent || '');
}

function decodeXmlText(value: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function parseRowCells(rowXml: string, sharedStrings: string[]): Map<string, string> {
  const cells = new Map<string, string>();
  // Trata células normais e autocontidas (<c .../>). Sem isso, uma célula vazia
  // poderia capturar o conteúdo da célula seguinte e deslocar os valores da linha.
  const regex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rowXml))) {
    const attrs = match[1];
    const body = match[2] || '';
    const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || '';
    const value = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];

    if (type === 's' && value !== undefined) {
      cells.set(ref, sharedStrings[Number(value)] ?? '');
    } else if (type === 'inlineStr') {
      const text = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((item) => decodeXmlText(item[1])).join('');
      cells.set(ref, text);
    } else if (value !== undefined) {
      // Valores numéricos (datas seriais, potência etc.) não precisam de decodificação HTML.
      // Evitar criar elementos DOM para centenas de milhares de células reduz muito o custo da leitura.
      cells.set(ref, value);
    }
  }
  return cells;
}

function rawGroupId(setor: string, linha: string, potencia: number, turno?: ProductionTurno): string {
  return `${normalizeText(setor)}|${normalizeText(linha)}|${potencia}|${turno || ''}`;
}

function excelSerialToYmd(serial: number): string {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function cellDateToYmd(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) return excelSerialToYmd(numeric);

  const iso = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const br = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;

  return '';
}

type ProductionReadMode =
  | { mode: 'DAY'; value: string }
  | { mode: 'MONTH'; value: string };

async function readProductionImportExcelPeriod(
  file: File,
  period: ProductionReadMode,
  onProgress?: (rowsProcessed: number) => void,
): Promise<ProductionMonthImportPreview> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo Excel no formato .xlsx.');
  if (period.mode === 'DAY' && !/^\d{4}-\d{2}-\d{2}$/.test(period.value)) throw new Error('Informe uma data válida para a importação.');
  if (period.mode === 'MONTH' && !/^\d{4}-\d{2}$/.test(period.value)) throw new Error('Informe um mês válido para a importação.');

  const mesReferencia = period.mode === 'DAY' ? period.value.slice(0, 7) : period.value;
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);
  const workbookEntry = entries.get('xl/workbook.xml');
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookEntry || !relsEntry) throw new Error('O arquivo não possui uma estrutura XLSX válida.');

  const [workbookXml, relsXml] = await Promise.all([
    readEntryText(buffer, workbookEntry),
    readEntryText(buffer, relsEntry),
  ]);
  const sheetPath = resolveSheetPath(workbookXml, relsXml, 'Apontamento Final');
  const sheetEntry = entries.get(sheetPath);
  if (!sheetEntry) throw new Error('A aba “Apontamento Final” não pôde ser lida.');

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings = readSharedStrings(sharedEntry ? await readEntryText(buffer, sharedEntry) : null);
  const rawGroupsByDate = new Map<string, Map<string, RawProductionGroup>>();
  const rowsMatchedByDate = new Map<string, number>();
  const ignoredByDate = new Map<string, number>();
  let rowsProcessed = 0;
  let rowsMatched = 0;
  let ignoredWithoutPower = 0;
  let headerColumns: Record<'date' | 'power' | 'line' | 'sector' | 'turno', string> | null = null;

  const stream = await entryByteStream(buffer, sheetEntry);
  const reader = stream.pipeThrough(new TextDecoderStream('utf-8')).getReader();
  let pending = '';

  const processRow = (rowXml: string) => {
    rowsProcessed += 1;
    const cells = parseRowCells(rowXml, sharedStrings);
    if (!headerColumns) {
      const byHeader = new Map<string, string>();
      for (const [column, value] of cells) byHeader.set(normalizeText(value), column);
      const dateColumn = byHeader.get('DATA PRODUZIDA');
      const powerColumn = byHeader.get('POTENCIA');
      const lineColumn = byHeader.get('LINHA');
      const sectorColumn = byHeader.get('SETOR');
      const turnoColumn = byHeader.get('TURNO');
      if (!dateColumn || !powerColumn || !lineColumn || !sectorColumn || !turnoColumn) {
        throw new Error('A aba “Apontamento Final” precisa conter as colunas DATA PRODUZIDA, POTÊNCIA, LINHA, SETOR e TURNO.');
      }
      headerColumns = { date: dateColumn, power: powerColumn, line: lineColumn, sector: sectorColumn, turno: turnoColumn };
      return;
    }

    const rowDate = cellDateToYmd(cells.get(headerColumns.date) || '');
    if (!rowDate) return;
    if (period.mode === 'DAY' ? rowDate !== period.value : !rowDate.startsWith(`${period.value}-`)) return;

    rowsMatched += 1;
    rowsMatchedByDate.set(rowDate, (rowsMatchedByDate.get(rowDate) || 0) + 1);

    const powerRaw = (cells.get(headerColumns.power) || '').trim().replace(',', '.');
    const potencia = Number(powerRaw);
    if (!powerRaw || !Number.isFinite(potencia) || potencia <= 0) {
      ignoredWithoutPower += 1;
      ignoredByDate.set(rowDate, (ignoredByDate.get(rowDate) || 0) + 1);
      return;
    }

    const setor = (cells.get(headerColumns.sector) || '').trim();
    const linha = (cells.get(headerColumns.line) || '').trim();
    const turnoRaw = (cells.get(headerColumns.turno) || '').trim();
    const turno = normalizeProductionTurno(turnoRaw);
    if (!setor || !linha) return;
    if (!turno) {
      throw new Error(`Turno inválido na produção de ${rowDate}: “${turnoRaw || 'vazio'}”. Use 1º ou 2º turno no Excel.`);
    }

    let dayGroups = rawGroupsByDate.get(rowDate);
    if (!dayGroups) {
      dayGroups = new Map<string, RawProductionGroup>();
      rawGroupsByDate.set(rowDate, dayGroups);
    }
    const baseId = rawGroupId(setor, linha, potencia, turno);
    const id = `${rowDate}|${baseId}`;
    const existing = dayGroups.get(id);
    if (existing) existing.quantidade += 1;
    else dayGroups.set(id, { id, setorOriginal: setor, linhaOriginal: linha, turno, potencia, quantidade: 1 });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) pending += value;

    while (true) {
      const rowStart = pending.indexOf('<row');
      if (rowStart < 0) {
        if (pending.length > 2048) pending = pending.slice(-2048);
        break;
      }
      const rowEnd = pending.indexOf('</row>', rowStart);
      if (rowEnd < 0) {
        if (rowStart > 0) pending = pending.slice(rowStart);
        break;
      }
      processRow(pending.slice(rowStart, rowEnd + 6));
      pending = pending.slice(rowEnd + 6);
      if (onProgress && rowsProcessed % 10000 === 0) onProgress(rowsProcessed);
    }

    if (done) break;
  }

  if (!headerColumns) throw new Error('Não foi possível localizar o cabeçalho da aba “Apontamento Final”.');
  if (rowsMatched === 0) {
    if (period.mode === 'DAY') throw new Error(`Nenhum registro foi encontrado em DATA PRODUZIDA para ${period.value.split('-').reverse().join('/')}.`);
    const [ano, mes] = period.value.split('-');
    throw new Error(`Nenhum registro foi encontrado em DATA PRODUZIDA para ${mes}/${ano}.`);
  }

  const dias: ProductionImportPreview[] = [...rowsMatchedByDate.keys()].sort().map((data) => {
    const valid: ProductionImportGroup[] = [];
    const issues: ProductionImportIssue[] = [];
    for (const raw of rawGroupsByDate.get(data)?.values() || []) {
      const result = classifyRawProductionGroup(raw);
      if (result.group) valid.push(result.group);
      else issues.push(result.issue);
    }

    return {
      fileName: file.name,
      data,
      rowsProcessed,
      rowsMatched: rowsMatchedByDate.get(data) || 0,
      ignoredWithoutPower: ignoredByDate.get(data) || 0,
      validGroups: aggregateImportGroups(valid),
      issues: issues.sort((a, b) =>
        a.kind.localeCompare(b.kind)
        || a.setorOriginal.localeCompare(b.setorOriginal, 'pt-BR')
        || a.linhaOriginal.localeCompare(b.linhaOriginal, 'pt-BR')
        || a.potencia - b.potencia,
      ),
    };
  });

  return { fileName: file.name, mesReferencia, rowsProcessed, rowsMatched, ignoredWithoutPower, dias };
}

export async function readProductionImportExcel(
  file: File,
  data: string,
  onProgress?: (rowsProcessed: number) => void,
): Promise<ProductionImportPreview> {
  const result = await readProductionImportExcelPeriod(file, { mode: 'DAY', value: data }, onProgress);
  const day = result.dias.find((item) => item.data === data);
  if (!day) throw new Error(`Nenhum registro válido foi encontrado para ${data.split('-').reverse().join('/')}.`);
  return day;
}

export async function readProductionImportExcelMonth(
  file: File,
  mesReferencia: string,
  onProgress?: (rowsProcessed: number) => void,
): Promise<ProductionMonthImportPreview> {
  return readProductionImportExcelPeriod(file, { mode: 'MONTH', value: mesReferencia }, onProgress);
}

export function importUnitLabel(group: Pick<ProductionImportGroup, 'setor' | 'linha' | 'tipoBobina' | 'turno'>): string {
  const turno = group.turno ? ` · ${group.turno} turno` : '';
  if (group.setor === 'BOBINA AT/BT' && group.tipoBobina) return `Bobina ${group.tipoBobina}${turno}`;
  if (group.setor === 'MONTAGEM FINAL' || group.setor === 'MPA') return `${group.setor === 'MPA' ? 'MPA' : 'Montagem Final'} ${group.linha}${turno}`;
  const labels: Partial<Record<Setor, string>> = {
    'CORTE LASER': 'Corte do Laser',
    'CORTE DO NUCLEO': 'Corte do Núcleo',
    FERRAGEM: 'Ferragem',
    ISOLANTE: 'Isolante',
    'MONTAGEM NUCLEO': 'Montagem do Núcleo',
    PINTURA: 'Pintura',
    SOLDA: 'Solda',
    EPOXI: 'Epóxi',
  };
  return `${labels[group.setor] || String(group.setor)}${turno}`;
}
