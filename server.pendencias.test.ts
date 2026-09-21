// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('pg', () => ({ default: { Pool: class { query = query; async connect() { return { query, release: vi.fn() }; } } } }));
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
beforeEach(() => { query.mockReset(); });
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


describe('Ações transacionais da fila', () => {
  const body = { status: 'APROVADO', escopo: 'PENDENCIAS', versao: 'v1' };
  function mockRecord(overrides: Record<string, unknown> = {}, production = false, occurrences = true) {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ status_aprovacao: 'PENDENTE', versao: 'v1', origem_producao: 'IMPORTADO', complementado: false, ...overrides }] };
      if (sql.includes('AS possui_ocorrencias')) return { rows: [{ possui_producao: production, possui_ocorrencias: occurrences }] };
      if (sql.includes('RETURNING atualizado_em')) return { rows: [{ atualizado_em: '2026-09-10T12:00:00Z' }] };
      return { rows: [], rowCount: 1 };
    });
  }
  it.each(['PATCH', 'DELETE'])('nega %s a apontador', async (method) => {
    const path = method === 'PATCH' ? '/api/coordenacao/apontamentos/10/aprovacao' : '/api/coordenacao/pendencias-aprovacao/10';
    expect((await request(path, 'APONTADOR', { method, body: JSON.stringify(body) })).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it('aprova aguardando produção sem criar produção ou mudar complemento', async () => {
    mockRecord();
    const r = await request('/api/coordenacao/apontamentos/10/aprovacao', 'COORDENACAO', { method: 'PATCH', body: JSON.stringify(body) });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: '10', preservouProducao: false });
    const writes = query.mock.calls.map(c => c[0]).filter(sql => /^(UPDATE|DELETE|INSERT)/.test(sql.trim()));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("status_aprovacao = 'APROVADO'");
    expect(writes[0]).not.toMatch(/complementado|producao/);
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });
  it('preserva bloqueio de complemento quando já existe produção', async () => {
    mockRecord({}, true);
    const r = await request('/api/coordenacao/apontamentos/10/aprovacao', 'COORDENACAO', { method: 'PATCH', body: JSON.stringify(body) });
    expect(r.status).toBe(409);
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('aprova produção importada quando somente um turno foi complementado', async () => {
    mockRecord({ turno1_complementado: true, turno2_complementado: false }, true);
    const r = await request('/api/coordenacao/apontamentos/10/aprovacao', 'COORDENACAO', { method: 'PATCH', body: JSON.stringify(body) });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: '10', preservouProducao: true });
    expect(query.mock.calls.map(c => c[0]).join('\n')).toContain("status_aprovacao = 'APROVADO'");
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });
  it.each([true, false])('exclui ocorrências preservando produção existente: %s', async (production) => {
    mockRecord({}, production);
    const r = await request('/api/coordenacao/pendencias-aprovacao/10', 'COORDENACAO', { method: 'DELETE', body: JSON.stringify({ versao: 'v1' }) });
    expect(r.status).toBe(200);
    const sql = query.mock.calls.map(c => c[0]).join('\n');
    expect(sql).not.toMatch(/DELETE FROM (producao|programacao)/);
    expect(sql.includes('DELETE FROM apontamentos')).toBe(!production);
    expect(sql).toContain('DELETE FROM paradas_falta_material');
    expect(sql).toContain('DELETE FROM observacoes');
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });
  it.each([{ versao: 'v2' }, { status_aprovacao: 'APROVADO' }])('rejeita versão/estado alterado: %j', async (overrides) => {
    mockRecord(overrides);
    const r = await request('/api/coordenacao/pendencias-aprovacao/10', 'COORDENACAO', { method: 'DELETE', body: JSON.stringify({ versao: 'v1' }) });
    expect(r.status).toBe(409);
    expect(query.mock.calls.map(c => c[0]).join('\n')).not.toContain('DELETE FROM');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('registro removido responde 404, sem exclusões', async () => {
    query.mockResolvedValue({ rows: [] });
    const r = await request('/api/coordenacao/pendencias-aprovacao/10', 'COORDENACAO', { method: 'DELETE', body: JSON.stringify({ versao: 'v1' }) });
    expect(r.status).toBe(404);
    expect(query.mock.calls.map(c => c[0]).join('\n')).not.toContain('DELETE FROM');
  });
});
