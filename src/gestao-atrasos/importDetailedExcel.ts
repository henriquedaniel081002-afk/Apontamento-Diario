// Leitura incremental do XLSX existente: não carrega 378 mil linhas em objetos JS.
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


export type DetailedTipo = 'PROGRAMACAO' | 'APONTAMENTO';
export interface DetailedRow {
  serie: string; op: string; setor: string; linha: string;
  data_programada?: string; data_produzida?: string;
  cliente?: string; potencia?: string; referencia?: string; turno?: string; codigo_produto?: string;
}
export interface DetailedPreview { tipo: DetailedTipo; rows: DetailedRow[]; fileName: string; ignored: number; }
export function currentTwoMonths() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Manaus',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const y=Number(parts.find(p=>p.type==='year')?.value);const m=Number(parts.find(p=>p.type==='month')?.value);
  const inicio=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,10);
  const fim=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  return {inicio,fim};
}
export async function readDetailedExcel(file:File,tipo:DetailedTipo,onProgress?:(n:number)=>void):Promise<DetailedPreview> {
  if(!/\.xlsx$/i.test(file.name)) throw new Error('Arquivo .xlsx obrigatório.');
  const {inicio,fim}=currentTwoMonths();
  const buffer=await file.arrayBuffer();const entries=parseZipEntries(buffer);
  const wb=entries.get('xl/workbook.xml');const rels=entries.get('xl/_rels/workbook.xml.rels');
  if(!wb||!rels) throw new Error('Estrutura XLSX inválida.');
  const [wXml,rXml]=await Promise.all([readEntryText(buffer,wb),readEntryText(buffer,rels)]);
  const sheetName=tipo==='PROGRAMACAO'?'BASE PROG 2026':'Apontamento Final';
  const sheet=entries.get(resolveSheetPath(wXml,rXml,sheetName));
  if(!sheet)throw new Error(`A aba ${sheetName} não foi encontrada.`);
  const sharedEntry=entries.get('xl/sharedStrings.xml');
  const shared=readSharedStrings(sharedEntry?await readEntryText(buffer,sharedEntry):null);
  let columns:Record<string,string>|null=null;
  const rows:DetailedRow[]=[];const unique=new Set<string>();let processed=0,ignored=0;
  const processRow=(xml:string)=>{
    processed++;
    const cells=parseRowCells(xml,shared);
    if(!columns){
      const cols:Record<string,string>={};
      for(const [col,val] of cells) cols[normalizeText(val)]=col;
      const required=tipo==='PROGRAMACAO'?['SERIE','OP','SETOR','LINHA','DATA PROG.']:['SERIE','OP','SETOR','LINHA','DATA PRODUZIDA'];
      for(const col of required)if(!cols[col])throw new Error(`Coluna ${col} não encontrada em ${sheetName}.`);
      columns=cols;return;
    }
    const cell=(name:string)=>String(cells.get(columns![name])||'').trim();
    const date=excelSerialToYmd(cell(tipo==='PROGRAMACAO'?'DATA PROG.':'DATA PRODUZIDA'));
    if(!date||date<inicio||date>=fim)return;
    const serie=cell('SERIE'),op=cell('OP'),setor=normalizeText(cell('SETOR'));
    if(!/^\d+$/.test(serie)||!/^\d+$/.test(op)||!setor) {ignored++;return;}
    // OPs divergentes para a mesma série e setor são permitidas e sinalizadas após importar.
    const key=`${serie}|${setor}|${op}`;
    if(unique.has(key))throw new Error(`Registro idêntico de série ${serie}, setor ${setor} e OP ${op} repetido no arquivo. Importação cancelada.`);
    unique.add(key);
    const row:DetailedRow={serie,op,setor,linha:normalizeText(cell('LINHA')),potencia:cell('POTENCIA')};
    if(tipo==='PROGRAMACAO'){
      row.data_programada=date;row.cliente=cell('CLIENTE');row.referencia=cell('REFERENCIA');
    } else {
      row.data_produzida=date;row.turno=cell('TURNO');row.codigo_produto=cell('COD. PRODUTO');
    }
    rows.push(row);
  };
  const stream=await entryByteStream(buffer,sheet);
  const reader=stream.pipeThrough(new TextDecoderStream('utf-8')).getReader();
  let pending='';
  while(true){
    const {value,done}=await reader.read();if(value)pending+=value;
    while(true){
      const start=pending.indexOf('<row');
      if(start<0){if(pending.length>2048)pending=pending.slice(-2048);break;}
      const end=pending.indexOf('</row>',start);
      if(end<0){if(start>0)pending=pending.slice(start);break;}
      processRow(pending.slice(start,end+6));pending=pending.slice(end+6);
      if(processed%10000===0) {
        onProgress?.(processed);
        // Entrega um quadro ao navegador entre blocos grandes de linhas.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    if(done)break;
  }
  if(!rows.length)throw new Error(`Nenhum registro válido de ${inicio} até o mês atual foi encontrado.`);
  return {tipo,rows,fileName:file.name,ignored};
}
