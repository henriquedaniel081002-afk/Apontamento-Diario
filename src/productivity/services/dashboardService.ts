import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Employee, ProductionRecord } from '../types';
import { calculateConvertedQuantity } from '../utils/calculations';

export interface DashboardData {
  employees: Employee[];
  records: ProductionRecord[];
  officialWorkdays: string[];
  employeeControlReady: boolean;
}

const PAGE_SIZE = 1000;

const isMissingTable = (error: any, tableName: string) => {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return new RegExp(`42P01|PGRST205|${tableName}|relation .* does not exist`, 'i').test(text);
};

async function loadAllProductionRows(): Promise<any[]> {
  if (!supabase) return [];
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('vw_producao_detalhada')
      .select('*')
      .order('data', { ascending: true })
      .range(from, to);

    if (error) throw error;
    const rows = data || [];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

async function loadEmployeeControls(): Promise<{ rows: any[]; ready: boolean }> {
  if (!supabase) return { rows: [], ready: false };
  const { data, error } = await supabase
    .from('colaboradores_controle')
    .select('matricula,nome,setor,turno,primeira_producao,status,data_desligamento')
    .order('nome');

  if (error) {
    if (isMissingTable(error, 'colaboradores_controle')) return { rows: [], ready: false };
    throw error;
  }
  return { rows: data || [], ready: true };
}


async function loadEmployeeArchives(): Promise<{ rows: any[]; ready: boolean }> {
  if (!supabase) return { rows: [], ready: false };
  const { data, error } = await supabase
    .from('colaboradores_desligados')
    .select('matricula,nome,setor,turno,primeira_producao,data_desligamento')
    .order('nome');

  if (error) {
    if (isMissingTable(error, 'colaboradores_desligados')) return { rows: [], ready: false };
    throw error;
  }
  return { rows: data || [], ready: true };
}

const shiftLabel = (turno: unknown): Employee['shift'] => {
  const value = Number(turno);
  return value === 2 ? '2º Turno' : value === 1 ? '1º Turno' : 'Não informado';
};

export async function loadDashboardData(): Promise<DashboardData> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  const [productionRows, workdaysRes, controls, archives] = await Promise.all([
    loadAllProductionRows(),
    supabase
      .from('dias_trabalho')
      .select('data,dia_trabalho')
      .eq('dia_trabalho', true)
      .order('data'),
    loadEmployeeControls(),
    loadEmployeeArchives(),
  ]);

  if (workdaysRes.error) throw workdaysRes.error;

  // A produção define automaticamente quem passou a fazer parte do acompanhamento.
  // A primeira linha (dados ordenados por data) fixa a primeira aparição; nome/setor/turno
  // são atualizados pelas linhas seguintes para refletir o cadastro mais recente da produção.
  const employeeMap = new Map<string, Employee>();
  for (const row of productionRows) {
    const matricula = String(row.matricula ?? row.colaborador_id ?? '').trim();
    if (!matricula) continue;
    const existing = employeeMap.get(matricula);
    if (!existing) {
      employeeMap.set(matricula, {
        id: matricula,
        registration: matricula,
        name: String(row.nome ?? '').trim() || matricula,
        sector: String(row.setor ?? '').trim() || 'BOBINAGEM',
        shift: shiftLabel(row.turno),
        admissionDate: '',
        firstProductionDate: String(row.data ?? ''),
        role: '',
        status: 'Ativo',
      });
    } else {
      const nome = String(row.nome ?? '').trim();
      const setor = String(row.setor ?? '').trim();
      if (nome) existing.name = nome;
      if (setor) existing.sector = setor;
      existing.shift = shiftLabel(row.turno);
    }
  }

  // A tabela de controle representa somente o cadastro ativo.
  for (const row of controls.rows) {
    const matricula = String(row.matricula ?? '').trim();
    if (!matricula) continue;
    const existing = employeeMap.get(matricula);
    const controlled: Employee = {
      id: matricula,
      registration: matricula,
      name: String(row.nome ?? '').trim() || existing?.name || matricula,
      sector: String(row.setor ?? '').trim() || existing?.sector || 'BOBINAGEM',
      shift: row.turno == null ? (existing?.shift || 'Não informado') : shiftLabel(row.turno),
      admissionDate: '',
      firstProductionDate: String(row.primeira_producao ?? existing?.firstProductionDate ?? ''),
      role: '',
      status: 'Ativo',
    };
    employeeMap.set(matricula, controlled);
  }

  // Desligados ficam fora da base ativa, mas um registro mínimo é mantido em uma
  // tabela de arquivo para preservar a data de desligamento e o cálculo histórico.
  for (const row of archives.rows) {
    const matricula = String(row.matricula ?? '').trim();
    if (!matricula) continue;
    const existing = employeeMap.get(matricula);
    employeeMap.set(matricula, {
      id: matricula,
      registration: matricula,
      name: String(row.nome ?? '').trim() || existing?.name || matricula,
      sector: String(row.setor ?? '').trim() || existing?.sector || 'BOBINAGEM',
      shift: row.turno == null ? (existing?.shift || 'Não informado') : shiftLabel(row.turno),
      admissionDate: '',
      firstProductionDate: String(row.primeira_producao ?? existing?.firstProductionDate ?? ''),
      terminationDate: row.data_desligamento ? String(row.data_desligamento) : undefined,
      role: '',
      status: 'Desligado',
    });
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const records: ProductionRecord[] = productionRows.map((row: any) => {
    const rawQuantity = Number(row.quantidade_produzida || 0);
    const drawing = String(row.desenho ?? '');
    const matricula = String(row.matricula ?? row.colaborador_id ?? '').trim();

    return {
      id: row.id,
      employeeId: matricula,
      date: row.data,
      partCode: drawing,
      description: [row.linha, row.potencia].filter(Boolean).join(' • '),
      op: row.op ?? undefined,
      drawing: drawing || undefined,
      className: row.classe ?? undefined,
      power: row.potencia ?? undefined,
      sector: row.setor ?? undefined,
      machine: row.maquina ?? undefined,
      rawQuantity,
      convertedQuantity: calculateConvertedQuantity(rawQuantity, drawing),
      producedMinutes: Number(row.tempo_produzido_min || 0),
      stoppageMinutes: Number(row.tempo_parado_min || 0),
      overtimeMinutes: Number(row.hora_extra_min || 0),
      notes: row.observacao || undefined,
    };
  }).filter(record => record.employeeId);

  const officialWorkdays = (workdaysRes.data || []).map((row: any) => row.data);
  return { employees, records, officialWorkdays, employeeControlReady: controls.ready && archives.ready };
}

export async function replaceOfficialWorkdays(dates: string[]): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const { error: deleteError } = await supabase.from('dias_trabalho').delete().neq('data', '0001-01-01');
  if (deleteError) throw deleteError;

  if (dates.length === 0) return;

  const rows = dates.map(data => ({ data, dia_trabalho: true }));
  const { error: insertError } = await supabase.from('dias_trabalho').insert(rows);
  if (insertError) throw insertError;
}

export async function setEmployeeActiveStatus(employee: Employee, active: boolean, terminationDate?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const turno = employee.shift === '1º Turno' ? 1 : employee.shift === '2º Turno' ? 2 : null;

  if (!active) {
    if (!terminationDate) throw new Error('Informe a data de desligamento.');

    const archivePayload = {
      matricula: employee.registration,
      nome: employee.name,
      setor: employee.sector,
      turno,
      primeira_producao: employee.firstProductionDate || null,
      data_desligamento: terminationDate,
      updated_at: new Date().toISOString(),
    };

    const { error: archiveError } = await supabase
      .from('colaboradores_desligados')
      .upsert(archivePayload, { onConflict: 'matricula' });

    if (archiveError) {
      if (isMissingTable(archiveError, 'colaboradores_desligados')) {
        throw new Error('A tabela colaboradores_desligados ainda não existe no Supabase. Execute o SQL de atualização incluído no projeto.');
      }
      throw archiveError;
    }

    // Remove somente da base ativa. Produção, jornadas e demais registros permanecem intactos.
    const { error: deleteError } = await supabase
      .from('colaboradores_controle')
      .delete()
      .eq('matricula', employee.registration);

    if (deleteError) {
      // Evita deixar o arquivo marcado como desligado se a remoção da base ativa falhar.
      await supabase.from('colaboradores_desligados').delete().eq('matricula', employee.registration);
      if (isMissingTable(deleteError, 'colaboradores_controle')) {
        throw new Error('A tabela colaboradores_controle ainda não existe no Supabase. Execute o SQL de configuração.');
      }
      throw deleteError;
    }
    return;
  }

  // Mantido para compatibilidade futura: reativar remove do arquivo e volta para a base ativa.
  const payload = {
    matricula: employee.registration,
    nome: employee.name,
    setor: employee.sector,
    turno,
    primeira_producao: employee.firstProductionDate || null,
    status: 'ATIVO',
    data_desligamento: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('colaboradores_controle').upsert(payload, { onConflict: 'matricula' });
  if (error) throw error;
  await supabase.from('colaboradores_desligados').delete().eq('matricula', employee.registration);
}

export interface DeleteMonthResult {
  mes: string;
  producao_excluida: number;
  jornadas_excluidas: number;
}

export async function deleteRecordsByMonth(month: string): Promise<DeleteMonthResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase não configurado.');
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Selecione um mês válido.');
  }

  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error('Selecione um mês válido.');
  const startDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const endDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase.rpc('excluir_registros_mes', {
    p_data_inicio: startDate,
    p_data_fim: endDateExclusive,
  });

  if (error) {
    const text = `${error.code || ''} ${error.message || ''}`;
    if (/PGRST202|42883|excluir_registros_mes|function .* does not exist/i.test(text)) {
      throw new Error('A função de exclusão mensal ainda não existe no Supabase. Execute o arquivo supabase-exclusao-mensal-v15.sql incluído no projeto.');
    }
    if (/permission|42501|not authorized|execute/i.test(text)) {
      throw new Error('O Supabase bloqueou a exclusão mensal. Execute novamente o arquivo supabase-exclusao-mensal-v15.sql para liberar a função ao perfil público.');
    }
    throw error;
  }

  const result = (data && typeof data === 'object') ? data as any : {};
  return {
    mes: month,
    producao_excluida: Number(result.producao_excluida ?? 0),
    jornadas_excluidas: Number(result.jornadas_excluidas ?? 0),
  };
}
