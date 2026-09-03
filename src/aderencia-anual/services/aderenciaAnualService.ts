import { isSupabaseConfigured, supabase } from '../../productivity/lib/supabase';
import type { AderenciaAnualRecord, AderenciaAnualUpsertRow } from '../types';

const TABLE_NAME = 'aderencia_anual';
const PAGE_SIZE = 1000;

function configuredClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase.schema('public');
}

function friendlyError(error: unknown, operation: 'consultar' | 'importar'): Error {
  const value = error as { code?: string; message?: string; details?: string };
  const text = `${value?.code || ''} ${value?.message || ''} ${value?.details || ''}`;

  if (/42P01|PGRST205|relation .* does not exist|aderencia_anual.*not found/i.test(text)) {
    return new Error('A tabela public.aderencia_anual não foi encontrada no Supabase.');
  }
  if (/42501|permission|not authorized|row-level security|rls/i.test(text)) {
    return new Error(`O Supabase bloqueou a operação de ${operation} em public.aderencia_anual. Verifique as políticas de acesso da tabela.`);
  }
  if (/42P10|no unique or exclusion constraint/i.test(text)) {
    return new Error('O campo mes precisa possuir uma restrição UNIQUE para que a importação atualize meses existentes sem duplicidade.');
  }
  if (/failed to fetch|network|fetch/i.test(text)) {
    return new Error('Não foi possível conectar ao Supabase. Verifique a conexão e tente novamente.');
  }

  return new Error(`Não foi possível ${operation} os dados de Aderência Anual no Supabase.`);
}

function normalizeRecord(row: Record<string, unknown>): AderenciaAnualRecord {
  const numericOrNull = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    id: row.id as number | string | undefined,
    mes: String(row.mes || '').slice(0, 10),
    programado: numericOrNull(row.programado),
    realizado: numericOrNull(row.realizado),
    dias_uteis: numericOrNull(row.dias_uteis),
    created_at: row.created_at == null ? null : String(row.created_at),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
}

export const aderenciaAnualService = {
  async getAll(): Promise<AderenciaAnualRecord[]> {
    const client = configuredClient();
    const rows: AderenciaAnualRecord[] = [];
    let from = 0;

    try {
      while (true) {
        const { data, error } = await client
          .from(TABLE_NAME)
          .select('id,mes,programado,realizado,dias_uteis,created_at,updated_at')
          .order('mes', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const page = (data || []).map((row) => normalizeRecord(row as Record<string, unknown>));
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return rows;
    } catch (error) {
      throw friendlyError(error, 'consultar');
    }
  },

  async upsert(rows: AderenciaAnualUpsertRow[]): Promise<void> {
    if (rows.length === 0) throw new Error('Não há registros válidos para importar.');
    const client = configuredClient();

    try {
      const { error } = await client
        .from(TABLE_NAME)
        .upsert(rows, { onConflict: 'mes', ignoreDuplicates: false });
      if (error) throw error;
    } catch (error) {
      throw friendlyError(error, 'importar');
    }
  },
};
