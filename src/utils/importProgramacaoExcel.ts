export interface ProgramacaoImportGroup {
  dataProgramada: string;
  setor: string;
  linha: string;
  potencia: string;
  quantidade: number;
}

export interface ProgramacaoImportPreview {
  fileName: string;
  mesReferencia: string;
  rowsProcessed: number;
  rowsMatched: number;
  grupos: ProgramacaoImportGroup[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const decoder = new TextDecoder('utf-8');

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function parseZipEntries(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('Arquivo inválido: estrutura ZIP do Excel não encontrada.');

  const entriesCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < entriesCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Arquivo Excel inválido.');
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    entries.set(name, { name, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function getCompressedEntryBytes(buffer: ArrayBuffer, entry: ZipEntry): Uint8Array {
  const view = new DataView(buffer);
  if (view.getUint32(entry.localHeaderOffset, true) !== 0x04034b50) throw new Error(`Entrada interna inválida: ${entry.name}.`);
  const fileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  return new Uint8Array(buffer, dataOffset, entry.compressedSize);
}

async function entryByteStream(buffer: ArrayBuffer, entry: ZipEntry): Promise<ReadableStream<Uint8Array>> {
  const source = new Blob([getCompressedEntryBytes(buffer, entry)]).stream();
  if (entry.compressionMethod === 0) return source;
  if (entry.compressionMethod !== 8) throw new Error(`Formato de compactação não suportado (${entry.compressionMethod}).`);
  if (typeof DecompressionStream === 'undefined') throw new Error('Atualize o Chrome/Edge para importar este Excel.');
  return source.pipeThrough(new DecompressionStream('deflate-raw'));
}

async function readEntryText(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  return new Response(await entryByteStream(buffer, entry)).text();
}

function xmlDocument(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Não foi possível interpretar a estrutura interna do Excel.');
  return doc;
}

function resolveSheetPath(workbookXml: string, relsXml: string, sheetName: string): string {
  const workbook = xmlDocument(workbookXml);
  const sheet = [...workbook.getElementsByTagName('sheet')].find((item) => item.getAttribute('name') === sheetName);
  if (!sheet) throw new Error(`A aba “${sheetName}” não foi encontrada no arquivo.`);
  const relationshipId = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rels = xmlDocument(relsXml);
  const relation = [...rels.getElementsByTagName('Relationship')].find((item) => item.getAttribute('Id') === relationshipId);
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
  const regex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rowXml))) {
    const attrs = match[1];
    const body = match[2] || '';
    const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || '';
    const value = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
    if (type === 's' && value !== undefined) cells.set(ref, sharedStrings[Number(value)] ?? '');
    else if (type === 'inlineStr') {
      const text = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((item) => decodeXmlText(item[1])).join('');
      cells.set(ref, text);
    } else if (value !== undefined) cells.set(ref, value);
  }
  return cells;
}

function excelSerialToYmd(value: string): string | null {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const utc = Date.UTC(1899, 11, 30) + Math.floor(numeric) * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(text);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return null;
}

function groupKey(data: string, setor: string, linha: string, potencia: string): string {
  return `${data}|${setor}|${linha}|${potencia}`;
}

export async function readProgramacaoExcel(
  file: File,
  mesReferencia: string,
  onProgress?: (rowsProcessed: number) => void,
): Promise<ProgramacaoImportPreview> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo Excel no formato .xlsx.');
  if (!/^\d{4}-\d{2}$/.test(mesReferencia)) throw new Error('Selecione o mês de referência.');

  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);
  const workbookEntry = entries.get('xl/workbook.xml');
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookEntry || !relsEntry) throw new Error('O arquivo não possui uma estrutura XLSX válida.');

  const [workbookXml, relsXml] = await Promise.all([readEntryText(buffer, workbookEntry), readEntryText(buffer, relsEntry)]);
  const sheetPath = resolveSheetPath(workbookXml, relsXml, 'BASE PROG 2026');
  const sheetEntry = entries.get(sheetPath);
  if (!sheetEntry) throw new Error('A aba “BASE PROG 2026” não pôde ser lida.');
  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings = readSharedStrings(sharedEntry ? await readEntryText(buffer, sharedEntry) : null);

  let rowsProcessed = 0;
  let rowsMatched = 0;
  let headerColumns: Record<'date'|'sector'|'line'|'power', string> | null = null;
  const groups = new Map<string, ProgramacaoImportGroup>();

  const processRow = (rowXml: string) => {
    rowsProcessed += 1;
    const cells = parseRowCells(rowXml, sharedStrings);
    if (!headerColumns) {
      const byHeader = new Map<string, string>();
      for (const [column, value] of cells) byHeader.set(normalizeText(value), column);
      const date = byHeader.get('DATA PROG.') || byHeader.get('DATA PROG');
      const sector = byHeader.get('SETOR');
      const line = byHeader.get('LINHA');
      const power = byHeader.get('POTENCIA');
      if (!date || !sector || !line || !power) throw new Error('A aba “BASE PROG 2026” precisa conter DATA PROG., SETOR, LINHA e POTÊNCIA.');
      headerColumns = { date, sector, line, power };
      return;
    }

    const data = excelSerialToYmd(cells.get(headerColumns.date) || '');
    if (!data || !data.startsWith(`${mesReferencia}-`)) return;
    rowsMatched += 1;

    const setor = (cells.get(headerColumns.sector) || '').trim().replace(/\s+/g, ' ');
    const linha = (cells.get(headerColumns.line) || '').trim().replace(/\s+/g, ' ');
    const potencia = (cells.get(headerColumns.power) || '').trim().replace(',', '.');
    if (!setor || !linha || !potencia) return;

    const key = groupKey(data, setor, linha, potencia);
    const current = groups.get(key);
    if (current) current.quantidade += 1;
    else groups.set(key, { dataProgramada: data, setor, linha, potencia, quantidade: 1 });
  };

  const stream = await entryByteStream(buffer, sheetEntry);
  const reader = stream.pipeThrough(new TextDecoderStream('utf-8')).getReader();
  let pending = '';
  while (true) {
    const { value, done } = await reader.read();
    if (value) pending += value;
    while (true) {
      const start = pending.indexOf('<row');
      if (start < 0) { if (pending.length > 2048) pending = pending.slice(-2048); break; }
      const end = pending.indexOf('</row>', start);
      if (end < 0) { if (start > 0) pending = pending.slice(start); break; }
      processRow(pending.slice(start, end + 6));
      pending = pending.slice(end + 6);
      if (onProgress && rowsProcessed % 10000 === 0) onProgress(rowsProcessed);
    }
    if (done) break;
  }

  if (!headerColumns) throw new Error('Não foi possível localizar o cabeçalho da aba “BASE PROG 2026”.');
  if (rowsMatched === 0) throw new Error(`Nenhum registro de DATA PROG. foi encontrado para ${mesReferencia.split('-').reverse().join('/')}.`);

  return {
    fileName: file.name,
    mesReferencia,
    rowsProcessed,
    rowsMatched,
    grupos: [...groups.values()].sort((a,b) => a.dataProgramada.localeCompare(b.dataProgramada) || a.setor.localeCompare(b.setor,'pt-BR') || a.linha.localeCompare(b.linha,'pt-BR') || a.potencia.localeCompare(b.potencia,'pt-BR',{numeric:true})),
  };
}
