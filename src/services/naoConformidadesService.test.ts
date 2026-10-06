import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiClient';
import { naoConformidadesService } from './naoConformidadesService';
import { storeSession } from './sessionStore';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('Service de Não Conformidades', () => {
  it('reutiliza apiRequest/Bearer e codifica todos os filtros', async () => {
    storeSession({ id: '1', name: 'Teste', perfil: 'APONTADOR', setor: 'SOLDA', linhas: ['MON'] }, 'jwt-test');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ registros: [], setores: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await naoConformidadesService.listar({ dataInicio: '2026-10-01', dataFim: '2026-10-06', setorId: '1', status: 'REPARADO', busca: 'OP & série' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('busca')).toBe('OP & série');
    expect(params.get('status')).toBe('REPARADO');
    expect(params.get('setorId')).toBe('1');
    expect(params.get('dataInicio')).toBe('2026-10-01');
    expect(params.get('dataFim')).toBe('2026-10-06');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer jwt-test');
    expect(init.cache).toBe('no-store');
  });
  it('envia somente descrição e propaga ApiError do backend', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'Já reparada' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(naoConformidadesService.reparar('42', 'Solda refeita')).rejects.toEqual(new ApiError('Já reparada', 409, { error: 'Já reparada' }));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/nao-conformidades/42/reparar');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ descricaoReparo: 'Solda refeita' });
  });
});
