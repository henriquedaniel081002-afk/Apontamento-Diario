import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const range = vi.fn();
  const order = vi.fn(() => ({ range }));
  const select = vi.fn(() => ({ order }));
  const upsert = vi.fn();
  const from = vi.fn(() => ({ select, upsert }));
  const schema = vi.fn(() => ({ from }));
  return { range, order, select, upsert, from, schema };
});

vi.mock('../../productivity/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { schema: mocks.schema },
}));

import { aderenciaAnualService } from './aderenciaAnualService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('aderenciaAnualService', () => {
  it('consulta exclusivamente public.aderencia_anual', async () => {
    mocks.range.mockResolvedValueOnce({
      data: [{ id: 1, mes: '2026-08-01', programado: 100, realizado: 95, dias_uteis: 21 }],
      error: null,
    });

    const result = await aderenciaAnualService.getAll();

    expect(mocks.schema).toHaveBeenCalledWith('public');
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('aderencia_anual');
    expect(result[0]).toMatchObject({ mes: '2026-08-01', programado: 100, realizado: 95, dias_uteis: 21 });
  });

  it('faz upsert por mes sem executar exclusões', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: null });
    const rows = [{ mes: '2026-08-01', programado: 100, realizado: 95, dias_uteis: 21 }];

    await aderenciaAnualService.upsert(rows);

    expect(mocks.schema).toHaveBeenCalledWith('public');
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('aderencia_anual');
    expect(mocks.upsert).toHaveBeenCalledWith(rows, { onConflict: 'mes', ignoreDuplicates: false });
  });
});
