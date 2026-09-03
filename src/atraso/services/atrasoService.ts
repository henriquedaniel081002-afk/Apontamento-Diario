import { isSupabaseConfigured, supabase } from '../../productivity/lib/supabase';
import type { AtrasoRecord } from '../types';

const TABLE = 'controle_atrasos';
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 500;

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function normalizeRecord(row: any): AtrasoRecord {
  return {
    serie: Number(row.serie),
    potencia: row.potencia === null || row.potencia === undefined || row.potencia === '' ? null : Number(row.potencia),
    linha: String(row.linha || '').trim(),
    op: row.op === null || row.op === undefined || row.op === '' ? null : Number(row.op),
    cliente: String(row.cliente || '').trim(),
    data_programada: String(row.data_programada || '').slice(0, 10),
    setor: String(row.setor || '').trim(),
    status: String(row.status || '').trim().toUpperCase() as AtrasoRecord['status'],
  };
}

async function fetchAllRecords(): Promise<AtrasoRecord[]> {
  const client = ensureSupabase();
  const all: AtrasoRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(TABLE)
      .select('serie,potencia,linha,op,cliente,data_programada,setor,status')
      .in('status', ['ATRASO', 'ADIANTAMENTO'])
      .order('data_programada', { ascending: true })
      .order('serie', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = (data || []).map(normalizeRecord);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

async function insertBatches(rows: AtrasoRecord[]) {
  const client = ensureSupabase();
  for (let index = 0; index < rows.length; index += WRITE_BATCH_SIZE) {
    const batch = rows.slice(index, index + WRITE_BATCH_SIZE);
    const { error } = await client.from(TABLE).insert(batch);
    if (error) throw error;
  }
}

async function clearTargetStatuses() {
  const client = ensureSupabase();
  const { error } = await client
    .from(TABLE)
    .delete()
    .in('status', ['ATRASO', 'ADIANTAMENTO']);
  if (error) throw error;
}

export const atrasoService = {
  async getAll(): Promise<AtrasoRecord[]> {
    return fetchAllRecords();
  },

  async replaceAll(rows: AtrasoRecord[]): Promise<{ imported: number }> {
    if (!rows.length) throw new Error('O arquivo não possui registros de ATRASO ou ADIANTAMENTO para importar.');

    const previousRows = await fetchAllRecords();
    let destructiveStepStarted = false;

    try {
      await clearTargetStatuses();
      destructiveStepStarted = true;
      await insertBatches(rows);
      return { imported: rows.length };
    } catch (error) {
      if (destructiveStepStarted) {
        try {
          await clearTargetStatuses();
          if (previousRows.length) await insertBatches(previousRows);
        } catch (rollbackError) {
          console.error('Falha ao restaurar a base anterior de atrasos.', rollbackError);
        }
      }
      throw error;
    }
  },
};
