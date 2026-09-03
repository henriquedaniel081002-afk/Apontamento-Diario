import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export interface ImportPreview {
  fileName: string;
  productionRows: number;
  firstDate: string | null;
  lastDate: string | null;
  availableMonths: string[];
  productionPayload: any[];
  warnings: string[];
}

const normalizeHeader = (value: unknown) => String(value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const pick = (row: Record<string, any>, aliases: string[]) => {
  const map = new Map(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
  for (const alias of aliases) {
    const value = map.get(normalizeHeader(alias));
    if (value !== undefined) return value;
  }
  return undefined;
};

function excelDateToISO(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
  }
  const text = String(value).trim();
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(text);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return null;
}

const numberOrZero = (value: any) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const textOrNull = (value: any) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

export async function parseProductivityWorkbook(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  const productionSheetName = wb.SheetNames.find(n => normalizeHeader(n) === 'BOBINAGEM (MAQ)');
  if (!productionSheetName) {
    throw new Error('O Excel precisa conter a aba "BOBINAGEM (MÁQ)". A BASE DE FUNCIONARIOS não é mais utilizada.');
  }

  const productionRowsRaw = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[productionSheetName], { defval: null, raw: true });
  if (productionRowsRaw.length === 0) throw new Error('A aba BOBINAGEM (MÁQ) está vazia.');

  const productionPayload = productionRowsRaw.map((r, index) => {
    const data = excelDateToISO(pick(r, ['DATA']));
    const matricula = textOrNull(pick(r, ['MATRÍCULA', 'MATRICULA']));
    if (!data || !matricula) throw new Error(`Aba BOBINAGEM (MÁQ): linha ${index + 2} está sem data ou matrícula válida.`);

    const turnoRaw = pick(r, ['TURNO', 'Turno']);
    const turnoNumber = Number(String(turnoRaw ?? '').replace(/\D/g, ''));

    return {
      data,
      matricula,
      nome: textOrNull(pick(r, ['NOME DO COLABORADOR', 'NOME COLABORADOR', 'NOME', 'NOME COMPLETO', 'COLABORADOR', 'OPERADOR', 'FUNCIONÁRIO', 'FUNCIONARIO'])),
      setor: textOrNull(pick(r, ['SETOR'])) || 'BOBINAGEM',
      turno: [1, 2].includes(turnoNumber) ? turnoNumber : null,
      maquina: textOrNull(pick(r, ['MÁQUINA', 'MAQUINA'])),
      op: textOrNull(pick(r, ['OP'])),
      desenho: textOrNull(pick(r, ['DESENHO'])),
      classe: textOrNull(pick(r, ['CLASSE'])),
      linha: textOrNull(pick(r, ['LINHA'])),
      potencia: textOrNull(pick(r, ['POTÊNCIA', 'POTENCIA'])),
      quantidade_produzida: numberOrZero(pick(r, ['QUANTIDADE PRODUZIDA', 'QTDE', 'QTD'])),
      tempo_parado_min: numberOrZero(pick(r, ['TEMPO'])),
      hora_extra_min: numberOrZero(pick(r, ['HORA EXTRA (min)', 'HORA EXTRA'])),
      tempo_produzido_min: numberOrZero(pick(r, ['REALIZADO', 'TEMPO PRODUZIDO (MINUTOS)', 'TEMPO PRODUZIDO'])),
      observacao: textOrNull(pick(r, ['OBS', 'OBSERVAÇÃO', 'OBSERVACAO', 'OBSERVAÇÕES', 'OBSERVACOES'])),
    };
  });

  const dates = productionPayload.map(p => p.data).sort();
  const availableMonths = Array.from(new Set(dates.map(date => date.slice(0, 7)))).sort();
  const warnings: string[] = [];

  const missingNames = productionPayload.filter(p => !p.nome).length;
  if (missingNames > 0) {
    warnings.push(`${missingNames} registro(s) não possuem nome na aba de produção; nesses casos o dashboard exibirá a matrícula como identificação.`);
  }

  const overtimeByDay = new Map<string, Set<number>>();
  for (const row of productionPayload) {
    if (row.hora_extra_min > 0) {
      const key = `${row.matricula}|${row.data}`;
      if (!overtimeByDay.has(key)) overtimeByDay.set(key, new Set());
      overtimeByDay.get(key)!.add(row.hora_extra_min);
    }
  }
  const conflicts = Array.from(overtimeByDay.entries()).filter(([, values]) => values.size > 1);
  if (conflicts.length) warnings.push(`${conflicts.length} colaborador(es)/dia possuem valores diferentes de hora extra; será utilizado o maior valor do dia.`);

  return {
    fileName: file.name,
    productionRows: productionPayload.length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    availableMonths,
    productionPayload,
    warnings,
  };
}

export function filterImportPreviewByMonths(preview: ImportPreview, months: string[]): ImportPreview {
  const selected = new Set(months);
  if (selected.size === 0) throw new Error('Selecione pelo menos um mês para importar.');

  const productionPayload = preview.productionPayload.filter(row => selected.has(String(row.data).slice(0, 7)));
  if (productionPayload.length === 0) throw new Error('Os meses selecionados não possuem registros de produção válidos.');

  const dates = productionPayload.map(row => row.data).sort();
  return {
    ...preview,
    productionRows: productionPayload.length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    productionPayload,
  };
}

async function syncEmployeeControls(productionPayload: any[]) {
  if (!supabase || productionPayload.length === 0) return null;

  const summaryMap = new Map<string, any>();
  for (const row of productionPayload) {
    const matricula = String(row.matricula || '').trim();
    if (!matricula) continue;
    const current = summaryMap.get(matricula);
    if (!current) {
      summaryMap.set(matricula, {
        matricula,
        nome: row.nome || matricula,
        setor: row.setor || 'BOBINAGEM',
        turno: row.turno || null,
        primeira_producao: row.data,
      });
      continue;
    }
    if (row.data && (!current.primeira_producao || row.data < current.primeira_producao)) current.primeira_producao = row.data;
    if (row.nome) current.nome = row.nome;
    if (row.setor) current.setor = row.setor;
    if (row.turno) current.turno = row.turno;
  }

  const summaries = Array.from(summaryMap.values());
  const matriculas = summaries.map(item => item.matricula);

  // Quem já foi desligado fica arquivado e não pode ser recriado na base ativa
  // por uma reimportação contendo registros históricos dessa matrícula.
  const { data: archived, error: archivedError } = await supabase
    .from('colaboradores_desligados')
    .select('matricula')
    .in('matricula', matriculas);
  if (archivedError) throw archivedError;
  const archivedSet = new Set((archived || []).map((row: any) => String(row.matricula)));

  const rows = summaries
    .filter(item => !archivedSet.has(item.matricula))
    .map(item => ({
      ...item,
      status: 'ATIVO',
      data_desligamento: null,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('colaboradores_controle')
      .upsert(rows, { onConflict: 'matricula' });
    if (upsertError) throw upsertError;
  }
  return rows.length;
}

export async function importProductivity(preview: ImportPreview) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.rpc('importar_produtividade', {
    p_producao: preview.productionPayload,
  });
  if (error) {
    if (/permission denied|not authorized|JWT|401|403/i.test(`${error.code || ''} ${error.message || ''}`)) {
      throw new Error('O Supabase bloqueou a função de importação para acesso público. Este dashboard não usa login; libere EXECUTE da função importar_produtividade(jsonb) para o perfil anon.');
    }
    if (/DELETE requires a WHERE clause/i.test(`${error.message || ''}`)) {
      throw new Error('A função de importação do Supabase ainda usa DELETE sem WHERE. Execute o arquivo supabase-fix-importacao-v10.sql incluído no projeto.');
    }
    throw error;
  }

  // A importação de produção já foi concluída neste ponto. A sincronização do
  // gerenciamento é complementar e nunca deve mascarar uma importação bem-sucedida.
  try {
    const colaboradoresSincronizados = await syncEmployeeControls(preview.productionPayload);
    return typeof data === 'object' && data !== null
      ? { ...data, colaboradores_sincronizados: colaboradoresSincronizados }
      : { resultado: data, colaboradores_sincronizados: colaboradoresSincronizados };
  } catch (syncError: any) {
    return typeof data === 'object' && data !== null
      ? { ...data, controle_colaboradores_aviso: syncError?.message || 'Não foi possível sincronizar o gerenciamento de colaboradores.' }
      : { resultado: data, controle_colaboradores_aviso: syncError?.message || 'Não foi possível sincronizar o gerenciamento de colaboradores.' };
  }
}
