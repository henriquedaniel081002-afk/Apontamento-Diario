import { Apontamento } from '../types';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type CellValue = string | number;
type ExcelRow = Record<string, CellValue>;

function formatDataExcel(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return `${day}/${MESES[month - 1]}`;
}

function setorParaExcel(setor: string): string {
  const nomes: Record<string, string> = {
    'CORTE LASER': 'CORTE DO LASER',
    'MONTAGEM NUCLEO': 'MONTAGEM DO NUCLEO',
  };
  return nomes[setor] || setor;
}

function turnoNumero(turno: string): number {
  return String(turno).trim().startsWith('2') ? 2 : 1;
}

function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function cellXml(ref: string, value: CellValue): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const text = xmlEscape(String(value ?? ''));
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function sheetXml(rows: ExcelRow[], headers: string[], widths: number[]): string {
  const allRows: CellValue[][] = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? '')),
  ];

  const cols = widths
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const sheetData = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => cellXml(`${columnName(colIndex)}${rowIndex + 1}`, value))
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const lastColumn = columnName(headers.length - 1);
  const lastRow = Math.max(1, allRows.length);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>${sheetData}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const localHeader = concatBytes([
      uint32(0x04034B50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ]);

    localParts.push(localHeader, data);

    const centralHeader = concatBytes([
      uint32(0x02014B50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    ]);

    centralParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const localData = concatBytes(localParts);
  const centralData = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054B50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralData.length),
    uint32(localData.length),
    uint16(0),
  ]);

  return concatBytes([localData, centralData, end]);
}

export interface ApontamentosWorkbookData {
  produzido: ExcelRow[];
  faltas: ExcelRow[];
  obs: ExcelRow[];
}

export function buildApontamentosWorkbookData(apontamentos: Apontamento[]): ApontamentosWorkbookData {
  if (!apontamentos.length) throw new Error('Não há registros para exportar.');

  const ordenados = [...apontamentos].sort(
    (a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id),
  );

  const produzido: ExcelRow[] = ordenados.flatMap((apt) =>
    apt.producoes.map((item) => ({
      data: formatDataExcel(apt.data),
      potencia: Number(item.potencia),
      qtde: Number(item.quantidade),
      setor: setorParaExcel(String(apt.setor)),
      linha: item.linha,
    })),
  );

  const faltas: ExcelRow[] = ordenados.flatMap((apt) =>
    apt.faltas.map((item) => ({
      data: formatDataExcel(apt.data),
      faltas: Number(item.quantidade),
      turno: turnoNumero(item.turno),
      setor: setorParaExcel(String(apt.setor)),
      linha: item.linha,
    })),
  );

  const obs: ExcelRow[] = ordenados.flatMap((apt) => [
    ...apt.observacoes.map((item) => ({
      data: formatDataExcel(apt.data),
      obs: item.observacao,
      setor: setorParaExcel(String(apt.setor)),
      linha: item.linha,
    })),
    ...apt.faltas
      .filter((item) => String(item.justificativa || '').trim().length > 0)
      .map((item) => ({
        data: formatDataExcel(apt.data),
        obs: String(item.justificativa).trim(),
        setor: setorParaExcel(String(apt.setor)),
        linha: item.linha,
      })),
  ]);

  return { produzido, faltas, obs };
}

export function exportApontamentosExcel(apontamentos: Apontamento[]): void {
  const { produzido, faltas, obs } = buildApontamentosWorkbookData(apontamentos);

  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="produzido" sheetId="1" r:id="rId1"/>
    <sheet name="faltas" sheetId="2" r:id="rId2"/>
    <sheet name="obs" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`,
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(produzido, ['data', 'potencia', 'qtde', 'setor', 'linha'], [12, 12, 10, 28, 10]) },
    { name: 'xl/worksheets/sheet2.xml', content: sheetXml(faltas, ['data', 'faltas', 'turno', 'setor', 'linha'], [12, 10, 10, 28, 10]) },
    { name: 'xl/worksheets/sheet3.xml', content: sheetXml(obs, ['data', 'obs', 'setor', 'linha'], [12, 95, 28, 10]) },
  ];

  const zip = createZip(files);
  const zipBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const blob = new Blob([zipBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const hoje = new Date();
  const stamp = [hoje.getFullYear(), String(hoje.getMonth() + 1).padStart(2, '0'), String(hoje.getDate()).padStart(2, '0')].join('-');
  link.href = url;
  link.download = `Apontamento_Diario_${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
