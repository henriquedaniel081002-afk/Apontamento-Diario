// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('pg', () => ({ default: { Pool: class { query = query; } } }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
let server: Server;
let base: string;
const secret = 'isolated-pending-approval-test';
const token = (perfil: string) => jwt.sign({ userId: 1, login: 'teste', perfil }, secret);
const request = (path: string, perfil = 'COORDENACAO', init: RequestInit = {}) => fetch(`${base}${path}`, {
  ...init, headers: { 'Content-Type': 'application/json', ...(perfil ? { Authorization: `Bearer ${token(perfil)}` } : {}), ...init.headers },
});

beforeAll(async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/isolated_test');
  vi.stubEnv('SESSION_SECRET', secret);
  vi.stubEnv('VERCEL', '1');
  const { default: app } = await import('./server');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});
beforeEach(() => query.mockReset());
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});

describe('API de pendências — acesso e preservação do fluxo', () => {
  it.each([['', 401], ['APONTADOR', 403]])('bloqueia perfil %s antes de consultar o banco', async (perfil, status) => {
    const r = await request('/api/coordenacao/pendencias-aprovacao', perfil as string);
    expect(r.status).toBe(status); expect(query).not.toHaveBeenCalled();
  });
  it.each(['dataInicio=2026-02-30', 'dataInicio=2026-09-10&dataFim=2026-09-01', 'tipo=PRODUCAO', 'pagina=-1'])('rejeita filtro inválido: %s', async (filter) => {
    expect((await request(`/api/coordenacao/pendencias-aprovacao?${filter}`)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it('usa parâmetros e consulta apenas o resumo quando fechado', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: 2, totalOcorrencias: 5, totalFiltrado: 1, pagina: 1, setores: ['SOLDA'], registros: [] }] });
    const r = await request('/api/coordenacao/pendencias-aprovacao?resumo=true&setor=SOLDA&tipo=FALTAS&dataInicio=2026-09-01');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ total: 2, totalOcorrencias: 5, tamanhoPagina: 20, registros: [] });
    expect(query).toHaveBeenCalledExactlyOnceWith(expect.any(String), ['2026-09-01', null, 'SOLDA', 'FALTAS', 1, 20, true]);
    expect(query.mock.calls[0][0]).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/);
    expect(r.headers.get('cache-control')).toContain('no-store');
  });
  it('carrega detalhes em lote e mantém as linhas ausentes sem inferir a produção', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: 1, totalOcorrencias: 1, totalFiltrado: 1, pagina: 1, setores: ['SOLDA'], registros: [{ id: '10', data: '2026-09-10', createdAt: '2026-09-10T11:00:00Z' }] }] });
    query.mockResolvedValueOnce({ rows: [{ apontamento_id: '10', id: '1', tipo: 'MATERIAL', turno: '2º TURNO', linha: null, detalhes: { Material: 'Chapa' } }] });
    const r = await request('/api/coordenacao/pendencias-aprovacao');
    expect(r.status).toBe(200);
    expect((await r.json()).registros[0].ocorrencias[0]).toMatchObject({ id: '1', turno: '2º turno', linha: null });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual([['10']]);
  });
  it('não introduz REPROVADO no endpoint de aprovação existente', async () => {
    const r = await request('/api/coordenacao/apontamentos/10/aprovacao', 'COORDENACAO', { method: 'PATCH', body: JSON.stringify({ status: 'REPROVADO' }) });
    expect(r.status).toBe(400); expect(query).not.toHaveBeenCalled();
  });
  it.each([
    { possui_producao: false, origem_producao: 'MANUAL', complementado: true },
    { possui_producao: true, origem_producao: 'IMPORTADO', complementado: false },
  ])('preserva bloqueio 409 no PATCH: %j', async (readiness) => {
    query.mockResolvedValueOnce({ rows: [readiness] });
    const r = await request('/api/coordenacao/apontamentos/10/aprovacao', 'COORDENACAO', { method: 'PATCH', body: JSON.stringify({ status: 'APROVADO' }) });
    expect(r.status).toBe(409); expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain('UPDATE');
  });
});
