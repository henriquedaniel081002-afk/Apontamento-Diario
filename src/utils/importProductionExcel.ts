import { Linha, ProductionImportGroup, Setor, TipoBobina } from '../types';

export interface RawProductionGroup {
  id: string;
  setorOriginal: string;
  linhaOriginal: string;
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

function sectorRule(rawSector: string): SectorRule | null {
  const sector = normalizeText(rawSector);
  const rules: Record<string, SectorRule> = {
    'BOBINA AT': { setor: 'BOBINA AT/BT', tipoBobina: 'AT', allowedLines: ['MON', 'TRI'] },
    'BOBINA BT': { setor: 'BOBINA AT/BT', tipoBobina: 'BT', allowedLines: ['MON', 'TRI'] },
    'CORTE DO LASER': { setor: 'CORTE LASER', allowedLines: ['MON', 'TRI'] },
    'CORTE LASER': { setor: 'CORTE LASER', allowedLines: ['MON', 'TRI'] },
    'ISOLANTE': { setor: 'ISOLANTE', allowedLines: ['MON', 'TRI'] },
    'MONTAGEM DO NUCLEO': { setor: 'MONTAGEM NUCLEO', allowedLines: ['MON', 'TRI'] },
    'MONTAGEM NUCLEO': { setor: 'MONTAGEM NUCLEO', allowedLines: ['MON', 'TRI'] },
    'MONTAGEM FINAL': { setor: 'MONTAGEM FINAL', allowedLines: ['MON', 'TRI'] },
    'MPA': { setor: 'MPA', allowedLines: ['MON', 'TRI'] },
    'PINTURA': { setor: 'PINTURA', allowedLines: ['MON', 'TRI'] },
    'SOLDA': { setor: 'SOLDA', allowedLines: ['MON', 'TRI'] },
  };
  return rules[sector] || null;
}

function importKey(group: ProductionImportGroup): string {
  return [group.setor, group.tipoBobina || '', group.linha, Number(group.potencia)].join('|');
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
    || a.potencia - b.potencia,
  );
}

export function classifyRawProductionGroup(group: RawProductionGroup):
  | { group: ProductionImportGroup; issue?: never }
  | { group?: never; issue: ProductionImportIssue } {
  const rawLine = normalizeText(group.linhaOriginal);

  // Regra operacional: somente MONTAGEM FINAL + linha EPO pertence ao Epóxi.
  // Registros EPO de qualquer outro setor seguem as regras normais do setor
  // (correção de linha quando houver apontador ou setor sem correspondência).
  if (normalizeText(group.setorOriginal) === 'MONTAGEM FINAL' && rawLine === 'EPO') {
    return {
      group: {
        setor: 'EPOXI',
        linha: 'EPO',
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

function ymdToExcelSerial(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) throw new Error('Informe uma data válida para a importação.');
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000);
}

function cellMatchesDate(value: string, ymd: string, targetSerial: number): boolean {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.floor(numeric) === targetSerial;
  const normalized = value.trim();
  if (normalized === ymd) return true;
  const [year, month, day] = ymd.split('-');
  return normalized === `${day}/${month}/${year}` || normalized === `${day}-${month}-${year}`;
}

function rawGroupId(setor: string, linha: string, potencia: number): string {
  return `${normalizeText(setor)}|${normalizeText(linha)}|${potencia}`;
}

export async function readProductionImportExcel(
  file: File,
  data: string,
  onProgress?: (rowsProcessed: number) => void,
): Promise<ProductionImportPreview> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo Excel no formato .xlsx.');
  if (!data) throw new Error('Informe a data que deve ser considerada.');

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
  const targetSerial = ymdToExcelSerial(data);
  const rawGroups = new Map<string, RawProductionGroup>();
  let ignoredWithoutPower = 0;
  let rowsProcessed = 0;
  let rowsMatched = 0;
  let headerColumns: Record<'date' | 'power' | 'line' | 'sector', string> | null = null;

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
      if (!dateColumn || !powerColumn || !lineColumn || !sectorColumn) {
        throw new Error('A aba “Apontamento Final” precisa conter as colunas DATA PRODUZIDA, POTÊNCIA, LINHA e SETOR.');
      }
      headerColumns = { date: dateColumn, power: powerColumn, line: lineColumn, sector: sectorColumn };
      return;
    }

    const dateValue = cells.get(headerColumns.date) || '';
    if (!cellMatchesDate(dateValue, data, targetSerial)) return;
    rowsMatched += 1;

    const powerRaw = (cells.get(headerColumns.power) || '').trim().replace(',', '.');
    const potencia = Number(powerRaw);
    if (!powerRaw || !Number.isFinite(potencia) || potencia <= 0) {
      ignoredWithoutPower += 1;
      return;
    }
    const setor = (cells.get(headerColumns.sector) || '').trim();
    const linha = (cells.get(headerColumns.line) || '').trim();
    if (!setor || !linha) return;

    const id = rawGroupId(setor, linha, potencia);
    const existing = rawGroups.get(id);
    if (existing) existing.quantidade += 1;
    else rawGroups.set(id, { id, setorOriginal: setor, linhaOriginal: linha, potencia, quantidade: 1 });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) pending += value;

    while (true) {
      const start = pending.indexOf('<row');
      if (start < 0) {
        if (pending.length > 2048) pending = pending.slice(-2048);
        break;
      }
      const end = pending.indexOf('</row>', start);
      if (end < 0) {
        if (start > 0) pending = pending.slice(start);
        break;
      }
      processRow(pending.slice(start, end + 6));
      pending = pending.slice(end + 6);
      if (onProgress && rowsProcessed % 10000 === 0) onProgress(rowsProcessed);
    }

    if (done) break;
  }

  if (!headerColumns) throw new Error('Não foi possível localizar o cabeçalho da aba “Apontamento Final”.');
  if (rowsMatched === 0) throw new Error(`Nenhum registro foi encontrado em DATA PRODUZIDA para ${data.split('-').reverse().join('/')}.`);

  const valid: ProductionImportGroup[] = [];
  const issues: ProductionImportIssue[] = [];
  for (const raw of rawGroups.values()) {
    const result = classifyRawProductionGroup(raw);
    if (result.group) valid.push(result.group);
    else issues.push(result.issue);
  }

  return {
    fileName: file.name,
    data,
    rowsProcessed,
    rowsMatched,
    ignoredWithoutPower,
    validGroups: aggregateImportGroups(valid),
    issues: issues.sort((a, b) =>
      a.kind.localeCompare(b.kind)
      || a.setorOriginal.localeCompare(b.setorOriginal, 'pt-BR')
      || a.linhaOriginal.localeCompare(b.linhaOriginal, 'pt-BR')
      || a.potencia - b.potencia,
    ),
  };
}

export function importUnitLabel(group: Pick<ProductionImportGroup, 'setor' | 'linha' | 'tipoBobina'>): string {
  if (group.setor === 'BOBINA AT/BT' && group.tipoBobina) return `Bobina ${group.tipoBobina}`;
  if (group.setor === 'MONTAGEM FINAL' || group.setor === 'MPA') return `${group.setor === 'MPA' ? 'MPA' : 'Montagem Final'} ${group.linha}`;
  const labels: Partial<Record<Setor, string>> = {
    'CORTE LASER': 'Corte do Laser',
    ISOLANTE: 'Isolante',
    'MONTAGEM NUCLEO': 'Montagem do Núcleo',
    PINTURA: 'Pintura',
    SOLDA: 'Solda',
    EPOXI: 'Epóxi',
  };
  return labels[group.setor] || String(group.setor);
}
