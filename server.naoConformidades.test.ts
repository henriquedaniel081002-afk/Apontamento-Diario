// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';

const db = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), release: vi.fn() }));
vi.mock('pg', () => ({ default: { Pool: class { query = db.query; connect = db.connect; } } }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

let server: Server;
let base: string;
let userId = 100;
let access: string[];
let records: any[];
let parentSector: string;
let failUpdate: boolean;
let mutex: Promise<void>;
const secret = 'isolated-nc-tests';
const sectors = ['SOLDA', 'PINTURA', 'CORTE LASER', 'FERRAGEM', 'MONTAGEM NUCLEO', 'CORTE DO NUCLEO', 'BOBINA AT/BT', 'ISOLANTE']
  .map((nome, i) => ({ id: String(i + 1), nome }));
const sectorId = (nome: string) => sectors.find((s) => s.nome === nome)!.id;
const nc = (id = '1', setor = 'SOLDA', extra: Record<string, unknown> = {}) => ({
  id, apontamento_id: '10', data: '2026-10-02', setor_id: sectorId(setor), setor,
  turno: '1º TURNO', causa_nao_conformidade: 'Falha na soldagem', op: 'OP-100', numero_serie: 'SER-20',
  criado_em: '2026-10-02T12:00:00Z', status_reparo: 'AGUARDANDO_REPARO', descricao_reparo: null,
  reparado_em: null, reparado_por: null, reparado_por_nome: null, ...extra,
});
const repaired = () => nc('1', parentSector, {
  status_reparo: 'REPARADO', descricao_reparo: 'Solda refeita', reparado_em: '2026-10-03T12:00:00Z', reparado_por: 91,
});
const request = (path: string, perfil = 'COORDENACAO', method = 'GET', body?: unknown) => fetch(`${base}${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...(perfil ? { Authorization: `Bearer ${jwt.sign({ userId, perfil, login: 'teste' }, secret)}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const repair = (perfil = 'COORDENACAO', body: unknown = { descricaoReparo: 'Refeito' }, id = '1') => request(`/api/nao-conformidades/${id}/reparar`, perfil, 'PATCH', body);
const writes = () => db.query.mock.calls.filter(([sql]) => /^(UPDATE|DELETE|INSERT)\b/.test(sql));
const ncWrites = () => writes().filter(([sql]) => /^(UPDATE|DELETE FROM|INSERT INTO) nao_conformidades\b/.test(sql));

// Modelo em memória para exercitar os handlers HTTP reais sem conectar ao Neon.
// As asserções também verificam SQL, parâmetros, escopo, lock e rollback.
type Transaction = { unlock?: () => void; snapshot?: any[] };
async function query(sql: string, params: any[] = [], transaction?: Transaction): Promise<any> {
  if (sql.includes('FROM nao_conformidades') && sql.includes('FOR UPDATE') && transaction && !transaction.unlock) {
    const previous = mutex;
    mutex = new Promise<void>((resolve) => { transaction.unlock = resolve; });
    await previous;
  }
  if (sql === 'COMMIT' || sql === 'ROLLBACK') {
    if (sql === 'ROLLBACK' && transaction?.snapshot) records = transaction.snapshot;
    transaction?.unlock?.();
    return { rows: [] };
  }
  if (sql.includes('FROM usuario_acessos ua')) return { rows: access.map((setor) => ({ setor, setor_id: sectorId(setor), linha: 'MON', linha_id: 1 })) };
  if (sql === 'SELECT id, nome FROM setores ORDER BY nome') return { rows: sectors };
  if (sql.startsWith('SELECT id FROM setores')) return { rows: [{ id: sectorId(params[0]) }] };
  if (sql.includes('FROM nao_conformidades nc')) {
    let rows = records;
    if (sql.includes('WHERE nc.id = $1')) rows = rows.filter((r) => r.id === String(params[0]));
    else rows = rows.filter((r) => params[0].includes(r.setor_id)
      && (!params[1] || r.data >= params[1]) && (!params[2] || r.data <= params[2])
      && (params[3] === 'ALL' || r.status_reparo === params[3])
      && (!params[4] || `${r.op} ${r.numero_serie}`.toLowerCase().includes(params[4].toLowerCase())));
    return { rows: structuredClone(rows) };
  }
  if (sql.startsWith('SELECT id, turno FROM nao_conformidades')) {
    return { rows: records.filter((r) => r.apontamento_id === String(params[0]) && (!params[1] || r.turno?.toUpperCase() === params[1])).map((r) => ({ id: r.id, turno: r.turno })) };
  }
  if (/^(UPDATE|DELETE FROM|INSERT INTO) nao_conformidades\b/.test(sql)) {
    if (transaction && !transaction.snapshot) transaction.snapshot = structuredClone(records);
    if (sql.startsWith('UPDATE') && failUpdate) throw new Error('Falha simulada');
    if (sql.includes("status_reparo = 'REPARADO'")) {
      Object.assign(records.find((r) => r.id === String(params[2])), {
        status_reparo: 'REPARADO', descricao_reparo: params[0], reparado_por: params[1], reparado_em: '2026-10-06T16:00:00Z', reparado_por_nome: 'CORTE LASER',
      });
    } else if (sql.startsWith('UPDATE')) {
      Object.assign(records.find((r) => r.id === String(params[5]) && r.apontamento_id === String(params[0])), {
        causa_nao_conformidade: params[1], op: params[2], numero_serie: params[3], turno: params[4],
      });
    } else if (sql.startsWith('INSERT')) {
      records.push(nc('1000', parentSector, { apontamento_id: String(params[0]), causa_nao_conformidade: params[1], op: params[2], numero_serie: params[3], turno: params[4] }));
    } else {
      records = records.filter((r) => r.apontamento_id !== String(params[0]) || (params[1] && !params[1].includes(r.id)));
    }
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes('AS possui_ocorrencias')) return { rows: [{ possui_producao: true, possui_ocorrencias: true }] };
  if (sql.includes('SELECT status_aprovacao')) return { rows: [{ status_aprovacao: 'PENDENTE', versao: 'v1', origem_producao: 'IMPORTADO', complementado: true }] };
  if (sql.includes('RETURNING atualizado_em')) return { rows: [{ atualizado_em: '2026-10-06T16:00:00Z' }] };
  if (sql.includes('FROM apontamentos a') || sql.includes('FROM apontamentos\n')) {
    return { rows: [{ id: 10, usuario_id: userId, setor_id: sectorId(parentSector), setor: parentSector,
      data: '2026-10-02', origem_producao: 'IMPORTADO', possui_producao: true, criado_em: '2026-10-02T12:00:00Z', atualizado_em: '2026-10-02T12:00:00Z' }] };
  }
  if (sql.includes('FROM nao_conformidades')) return { rows: structuredClone(records.filter((r) => r.apontamento_id === String(params[0]))) };
  return { rows: [], rowCount: 1 };
}

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
beforeEach(() => {
  userId++; access = ['SOLDA']; parentSector = 'SOLDA'; records = [nc()]; failUpdate = false; mutex = Promise.resolve();
  db.query.mockReset().mockImplementation(query);
  db.release.mockClear();
  db.connect.mockReset().mockImplementation(async () => {
    const transaction: Transaction = {};
    return { query: (sql: string, params?: any[]) => db.query(sql, params, transaction), release: db.release };
  });
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});

describe('Não Conformidades: autenticação, listagem e filtros', () => {
  it.each(['GET', 'PATCH'])('exige autenticação em %s', async (method) => {
    expect((await request(method === 'GET' ? '/api/nao-conformidades' : '/api/nao-conformidades/1/reparar', '', method)).status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });
  it('Coordenação recebe todos os setores, dados operacionais e login normalizado, sem dados sensíveis', async () => {
    records = [nc(), nc('2', 'PINTURA', { reparado_por_nome: 'CORTE LASER', password_hash: 'secret', status_reparo: 'REPARADO' })];
    const response = await request('/api/nao-conformidades');
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.registros).toHaveLength(2);
    expect(result.setores).toHaveLength(sectors.length);
    expect(result.registros[1]).toMatchObject({ reparadoPorNome: 'Corte do Laser/Ferragem', statusReparo: 'REPARADO' });
    expect(JSON.stringify(result)).not.toMatch(/secret|password|senha|hash/);
    expect(db.query.mock.calls.find(([sql]) => sql.includes('FROM nao_conformidades nc'))?.[0]).toContain('LEFT JOIN usuarios');
  });
  it('limita APONTADOR a todos os seus setores e ignora tentativa de ampliar o filtro', async () => {
    access = ['SOLDA', 'ISOLANTE'];
    records = [nc(), nc('2', 'PINTURA'), nc('3', 'ISOLANTE')];
    expect((await (await request('/api/nao-conformidades', 'APONTADOR')).json()).registros.map((r: any) => r.id)).toEqual(['1', '3']);
    const result = await (await request('/api/nao-conformidades?setorId=2', 'APONTADOR')).json();
    expect(result.registros).toEqual([]);
    expect(result.setores.map((s: any) => s.nome)).toEqual(['SOLDA', 'ISOLANTE']);
    expect(db.query.mock.calls.at(-1)?.[1][0]).toEqual([]);
  });
  it.each([['CORTE LASER', 'FERRAGEM'], ['MONTAGEM NUCLEO', 'CORTE DO NUCLEO'], ['BOBINA AT/BT', 'BOBINA AT/BT']])('reutiliza acesso %s para %s na listagem e no tratamento', async (loginSector, recordSector) => {
    access = [loginSector]; records = [nc('1', recordSector)];
    expect((await (await request('/api/nao-conformidades', 'APONTADOR')).json()).registros).toHaveLength(1);
    expect((await repair('APONTADOR')).status).toBe(200);
  });
  it('sem acesso configurado não recebe registros nem setores', async () => {
    access = [];
    expect(await (await request('/api/nao-conformidades', 'APONTADOR')).json()).toEqual({ registros: [], setores: [] });
  });
  it.each(['dataInicio=2026-02-30', 'dataInicio=2026-10-06&dataFim=2026-10-01', 'status=REABERTO', 'setorId=abc'])('recusa filtro inválido %s', async (filter) => {
    expect((await request(`/api/nao-conformidades?${filter}`)).status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
  it('filtra por data operacional, setor, status e OP/série com parâmetros', async () => {
    records = [nc('1', 'SOLDA', { criado_em: '2026-09-01T12:00:00Z' }), nc('2', 'PINTURA')];
    const result = await (await request('/api/nao-conformidades?dataInicio=2026-10-01&dataFim=2026-10-03&setorId=1&status=AGUARDANDO_REPARO&busca=SER-20')).json();
    expect(result.registros.map((r: any) => r.id)).toEqual(['1']);
    const [sql, params] = db.query.mock.calls.at(-1)!;
    expect(sql).toContain('a.data >= $2::date');
    expect(params).toEqual([['1'], '2026-10-01', '2026-10-03', 'AGUARDANDO_REPARO', 'SER-20']);
    expect(sql).not.toContain('SER-20');
  });
});

describe('Reparo: transação e autoridade do servidor', () => {
  it('retorna 403 fora do setor, sem gravações', async () => {
    access = ['PINTURA'];
    expect((await repair('APONTADOR')).status).toBe(403);
    expect(writes()).toEqual([]);
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(db.release).toHaveBeenCalledOnce();
  });
  it.each([undefined, null, '', ' \n\t ', 12, {}])('recusa descrição inválida %j com 400', async (descricaoReparo) => {
    expect((await repair('COORDENACAO', { descricaoReparo })).status).toBe(400);
    expect(writes()).toEqual([]);
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('aceita conteúdo de um caractere, usa JWT/NOW e preserva todos os campos operacionais', async () => {
    const before = { ...records[0] };
    const response = await repair('APONTADOR', { descricaoReparo: ' x ', reparadoPor: 999, reparado_por: 999, reparadoEm: '1990-01-01', status_reparo: 'AGUARDANDO_REPARO', op: 'forjada' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ statusReparo: 'REPARADO', descricaoReparo: 'x', reparadoPorId: String(userId), reparadoEm: '2026-10-06T16:00:00.000Z' });
    for (const key of ['apontamento_id', 'causa_nao_conformidade', 'op', 'numero_serie', 'criado_em', 'turno']) expect(records[0][key]).toBe(before[key]);
    expect(writes()).toHaveLength(1);
    const [sql, params] = writes()[0];
    expect(sql).toContain('reparado_em = NOW()');
    expect(sql).not.toMatch(/SET causa|SET op|SET apontamento/);
    expect(params).toEqual(['x', userId, 1]);
    expect(db.query.mock.calls.some(([sql]) => sql.includes('FOR UPDATE OF nc'))).toBe(true);
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });
  it('Coordenação trata qualquer setor', async () => {
    records = [nc('1', 'PINTURA')];
    expect((await repair()).status).toBe(200);
  });
  it('segunda tentativa retorna 409 e mantém o primeiro reparo', async () => {
    records = [repaired()];
    const before = structuredClone(records);
    expect((await repair()).status).toBe(409);
    expect(records).toEqual(before);
    expect(writes()).toEqual([]);
  });
  it('duas sessões concorrentes concluem apenas um reparo sob o lock', async () => {
    const responses = await Promise.all([repair(), repair()]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(writes()).toHaveLength(1);
  });
  it('retorna 404 para NC ausente e 400 para ID inválido', async () => {
    expect((await repair('COORDENACAO', {}, '999')).status).toBe(404);
    expect((await repair('COORDENACAO', {}, 'nc-temp')).status).toBe(400);
    expect(writes()).toEqual([]);
  });
  it('falha no banco faz rollback e libera a conexão', async () => {
    failUpdate = true;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await repair()).status).toBe(500);
    expect(records[0].status_reparo).toBe('AGUARDANDO_REPARO');
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(db.release).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe('Persistência: fluxos existentes preservam o reparo e a semântica de exclusão', () => {
  const editPayload = (naoConformidades: unknown[]) => ({ data: '2026-10-02', setor: parentSector, turno: '1º turno',
    naoConformidades, paradasFaltaMaterial: [], paradasMaquina: [], faltas: [], observacoes: [], producoes: [] });
  const operational = (id = '1') => ({ id, causaNaoConformidade: 'Causa corrigida', op: 'OP-200', numeroSerie: 'SER-22' });
  const routes = [
    ['/api/coordenacao/apontamentos/10', 'COORDENACAO', 'PUT'],
    ['/api/apontamentos/10', 'APONTADOR', 'PUT'],
    ['/api/apontamentos/10/complemento', 'APONTADOR', 'PUT'],
    ['/api/apontamentos/ocorrencias', 'APONTADOR', 'POST'],
  ];
  it.each(routes)('%s mantém ID, criação e reparo completo ao atualizar campos operacionais', async (path, perfil, method) => {
    records = [repaired()];
    const before = { ...records[0] };
    const response = await request(path, perfil, method, editPayload([{ ...operational(), status_reparo: 'AGUARDANDO_REPARO', reparado_por: 999 }]));
    expect(response.status).toBe(200);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ causa_nao_conformidade: 'Causa corrigida', op: 'OP-200', numero_serie: 'SER-22', turno: '1º TURNO' });
    for (const field of ['id', 'criado_em', 'status_reparo', 'descricao_reparo', 'reparado_em', 'reparado_por']) expect(records[0][field]).toEqual(before[field]);
    expect(ncWrites()).toHaveLength(1);
    expect(ncWrites()[0][0]).toMatch(/^UPDATE nao_conformidades/);
    expect(ncWrites()[0][0]).not.toMatch(/status_reparo|descricao_reparo|reparado_em|reparado_por|criado_em/);
    expect(writes().some(([sql]) => sql.startsWith('DELETE FROM producao'))).toBe(false);
    for (const table of ['paradas_falta_material', 'paradas_maquina', 'faltas', 'observacoes']) expect(writes().some(([sql]) => sql.startsWith(`DELETE FROM ${table}`))).toBe(true);
  });
  it('insere ID temporário usando defaults e remove somente NC omitida', async () => {
    records = [repaired(), nc('2')];
    expect((await request(routes[0][0], 'COORDENACAO', 'PUT', editPayload([operational(), operational('nc-nova')]))).status).toBe(200);
    expect(records.map((r) => r.id)).toEqual(['1', '1000']);
    expect(records[0].status_reparo).toBe('REPARADO');
    expect(records[1].status_reparo).toBe('AGUARDANDO_REPARO');
    expect(ncWrites().find(([sql]) => sql.startsWith('INSERT'))?.[0]).not.toMatch(/status_reparo|descricao_reparo|reparado_em|reparado_por/);
    expect(ncWrites().find(([sql]) => sql.startsWith('DELETE'))?.[1]).toEqual([10, ['2']]);
  });
  it.each([routes[2], routes[3]])('%s altera apenas o turno solicitado, incluindo exclusão', async (path, perfil, method) => {
    records = [repaired(), nc('2', 'SOLDA', { turno: '2º TURNO', status_reparo: 'REPARADO', descricao_reparo: 'Intacto' })];
    const other = { ...records[1] };
    expect((await request(path, perfil, method, editPayload([]))).status).toBe(200);
    expect(records).toEqual([other]);
    const lock = db.query.mock.calls.find(([sql]) => sql.startsWith('SELECT id, turno FROM nao_conformidades'))!;
    expect(lock[1]).toEqual([10, '1º TURNO']);
    expect(lock[0]).toContain('UPPER(COALESCE(turno');
  });
  it.each(['2', '999'])('ID de outro turno/apontamento ou excluído (%s) não é reaproveitado nem recriado', async (id) => {
    records = [repaired(), nc('2', 'SOLDA', { turno: '2º TURNO' })];
    const before = structuredClone(records);
    expect((await request('/api/apontamentos/10/complemento', 'APONTADOR', 'PUT', editPayload([operational(id)]))).status).toBe(409);
    expect(records).toEqual(before);
    expect(ncWrites()).toEqual([]);
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('coleção ausente preserva NCs e array vazio exclui todas na edição global', async () => {
    records = [repaired()];
    expect((await request(routes[0][0], 'COORDENACAO', 'PUT', { data: '2026-10-02', observacoes: [] })).status).toBe(200);
    expect(ncWrites()).toEqual([]);
    expect((await request(routes[0][0], 'COORDENACAO', 'PUT', editPayload([]))).status).toBe(200);
    expect(records).toEqual([]);
  });
  it('exclusão real de ocorrências na fila continua removendo inclusive NC reparada', async () => {
    records = [repaired()];
    expect((await request('/api/coordenacao/pendencias-aprovacao/10', 'COORDENACAO', 'DELETE', { versao: 'v1' })).status).toBe(200);
    expect(records).toEqual([]);
    expect(ncWrites()[0][0]).toBe('DELETE FROM nao_conformidades WHERE apontamento_id = $1');
    expect(writes().some(([sql]) => /DELETE FROM (producao|apontamentos)/.test(sql))).toBe(false);
  });
});
