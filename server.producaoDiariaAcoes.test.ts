// @vitest-environment node
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerProducaoDiariaAcoesRoutes } from './server.producaoDiariaAcoes';
import { registerProducaoDiariaObservacoesRoutes } from './server.producaoDiariaObservacoes';

const secret = 'chave-da-fixture-de-producao-diaria';
const authorization = (perfil: string) => 'Bearer ' + jwt.sign({ userId: 1, login: 'COORD-FIXTURE', perfil }, secret);
const auth: RequestHandler = (req, res, next) => {
  try {
    Object.assign(req, { auth: jwt.verify(req.headers.authorization?.slice(7) || '', secret) });
    next();
  } catch {
    res.sendStatus(401);
  }
};
const coordination: RequestHandler = (req, res, next) => {
  if ((req as typeof req & { auth: { perfil: string } }).auth.perfil !== 'COORDENACAO') res.sendStatus(403);
  else next();
};
const legacySql = 'SELECT data::text, setor, linha, observacao, atualizado_por_id, atualizado_por_login, criado_em, atualizado_em FROM producao_diaria_observacoes ORDER BY data, setor, linha';
const legacyActionId = '39f94045-3d96-4596-93b4-215f2572b99a';
const fixture = {
  observacao: 'Gabarito apresentou folga',
  data_origem: '2026-10-20', setor: 'MONTAGEM FINAL', linha: 'GERAL', plano_acao: 'Inspecionar gabarito',
  responsavel: 'Manutenção', prazo: '2026-10-25',
};
let db: PGlite;
let server: Server;
let base: string;
let legacy: unknown[];

function call(path: string, method = 'GET', body?: object, token = authorization('COORDENACAO')) {
  return fetch(base + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', authorization: token },
  });
}

async function create(overrides = {}) {
  const response = await call('/acoes', 'POST', { ...fixture, ...overrides });
  expect(response.status).toBe(201);
  return (await response.json()).acao;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE usuarios (id integer PRIMARY KEY);
    INSERT INTO usuarios VALUES (1), (2);`);
  await db.exec(await readFile('migrations/2026-11-09_producao_diaria_observacoes.sql', 'utf8'));
  await db.exec(`
    INSERT INTO producao_diaria_observacoes
      (data, setor, linha, observacao, atualizado_por_id, atualizado_por_login, criado_em, atualizado_em)
    SELECT DATE '2026-11-09' + d, s, 'GERAL', 'Nota anterior ' || d || ' de ' || s, 1, 'COORD-FIXTURE',
           '2026-11-09T15:12:13.123456Z', '2026-11-11T14:13:14.654321Z'
      FROM generate_series(0, 7) d
      CROSS JOIN unnest(ARRAY['MONTAGEM FINAL','MPA','PINTURA','SOLDA','ISOLANTE','FERRAGEM','BOBINA AT']) s;
  `);
  legacy = (await db.query(legacySql)).rows;
  const migration = await readFile('migrations/2026-11-19_producao_diaria_acoes.sql', 'utf8');
  await db.exec(migration);
  await db.query(`
    INSERT INTO producao_diaria_acoes
      (id, data_origem, setor, linha, plano_acao, responsavel, prazo,
       criado_por_id, criado_por_login, atualizado_por_id, atualizado_por_login)
    VALUES ($1, '2026-11-09', 'MONTAGEM FINAL', 'GERAL', 'Plano histórico', 'PCP', '2026-11-12',
            1, 'COORD-FIXTURE', 1, 'COORD-FIXTURE')
  `, [legacyActionId]);
  const occurrenceMigration = await readFile('migrations/2026-11-19_producao_diaria_ocorrencias.sql', 'utf8');
  await db.exec(occurrenceMigration);
  await db.exec(occurrenceMigration);
  const optionalMigration = await readFile('migrations/2026-11-19_producao_diaria_campos_opcionais.sql', 'utf8');
  await db.exec(optionalMigration);
  await db.exec(optionalMigration);
  const deleteMigration = await readFile('migrations/2026-11-19_producao_diaria_exclusao_acoes.sql', 'utf8');
  await db.exec(deleteMigration);
  await db.exec(deleteMigration);
  const app = express();
  app.use(express.json());
  const pool = db as unknown as Pool;
  registerProducaoDiariaObservacoesRoutes(app, pool, auth, coordination);
  registerProducaoDiariaAcoesRoutes(app, pool, auth, coordination);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/coordenacao/producao-diaria`;
}, 15000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await db?.close();
});

describe('API e persistência da Produção Diária', () => {
  it('reaplica a migração e preserva todos os atributos das 56 notas anteriores', async () => {
    expect(legacy).toHaveLength(56);
    expect((await db.query(legacySql)).rows).toEqual(legacy);
    expect((await db.query('SELECT count(*)::int total FROM producao_diaria_observacoes_historico')).rows).toEqual([{ total: 0 }]);
    const response = await call('/observacoes?dataInicio=2026-11-09&dataFim=2026-11-16');
    expect((await response.json()).observacoes).toHaveLength(56);
  });

  it('mantém observações independentes por linha, inclusive legado GERAL e EPO', async () => {
    const data = '2026-11-09';
    for (const [setor, linha, observacao] of [
      ['MONTAGEM FINAL', 'MON', 'Tratar MON'], ['MONTAGEM FINAL', 'TRI', 'Tratar TRI'], ['EPOXI', 'EPO', 'Anotar EPO'],
    ]) {
      const result = await call('/observacoes', 'PUT', { data, setor, linha, observacao, versao: null, atualizado_por_login: 'IGNORAR' });
      expect(result.status).toBe(200);
      expect((await result.json()).observacao).toMatchObject({ linha, versao: 1, atualizado_por_login: 'COORD-FIXTURE' });
    }
    const response = await call('/observacoes?dataInicio=2026-11-09&dataFim=2026-11-09&setor=MONTAGEM+FINAL');
    const { observacoes } = await response.json();
    expect(observacoes.map((item: { linha: string }) => item.linha)).toEqual(['GERAL', 'MON', 'TRI']);
    expect(observacoes[0].observacao).toBe('Nota anterior 0 de MONTAGEM FINAL');
    const legacyWriter = await call('/observacoes', 'PUT', { data, setor: 'MONTAGEM FINAL', linha: 'GERAL', observacao: 'Alteração legada' });
    expect((await legacyWriter.json()).observacao.versao).toBe(2);
    expect((await call('/observacoes', 'PUT', { data, setor: 'MONTAGEM FINAL', linha: 'GERAL', observacao: 'Versão antiga', versao: 1 })).status).toBe(409);
    expect((await db.query(`SELECT antes->>'observacao' anterior, depois->>'observacao' atual FROM producao_diaria_observacoes_historico WHERE data='2026-11-09' AND setor='MONTAGEM FINAL' AND linha='GERAL'`)).rows).toEqual([
      { anterior: 'Nota anterior 0 de MONTAGEM FINAL', atual: 'Alteração legada' },
    ]);
  });

  it('cria ações simultâneas GERAL, MON e TRI com IDs distintos, preservando ação geral única', async () => {
    const geral = await create();
    const mon = await create({ linha: 'MON' });
    const mon2 = await create({ linha: 'MON', observacao: 'Equipe reduzida', plano_acao: 'Plano adicional' });
    const tri = await create({ linha: 'TRI' });
    expect(new Set([geral.id, mon.id, mon2.id, tri.id]).size).toBe(4);
    const first = await call('/acoes?linha=MON&limit=2&dataOrigem=2026-10-20');
    const page1 = await first.json();
    const next = await call('/acoes?linha=MON&limit=2&dataOrigem=2026-10-20&cursor=' + page1.proximoCursor);
    const page2 = await next.json();
    expect([...page1.acoes, ...page2.acoes].map((item) => item.id).sort()).toEqual([geral.id, mon.id, mon2.id].sort());
    expect(page2.proximoCursor).toBeNull();
    const byId = new Map([...page1.acoes, ...page2.acoes].map((item) => [item.id, item.observacao]));
    expect(byId.get(mon.id)).toBe(fixture.observacao);
    expect(byId.get(mon2.id)).toBe('Equipe reduzida');
    const exactScope = await call('/acoes?linha=TRI&incluirGeral=false&dataOrigem=2026-10-20');
    expect((await exactScope.json()).acoes.map((item: { id: string }) => item.id)).toEqual([tri.id]);
  });

  it('registra os estados, reabertura, prazo e escopo sem mudar origem nem autoria', async () => {
    const action = await create({ data_origem: '2026-09-10', usuario_id: 2, criado_por_login: 'IGNORAR' });
    expect(action).toMatchObject({ situacao: 'PENDENTE', versao: 1, criado_por_login: 'COORD-FIXTURE' });
    const finish = await call('/acoes/' + action.id, 'PATCH', {
      versao: 1, situacao: 'EM_ANDAMENTO', prazo: '2026-11-01', linha: 'TRI', responsavel: 'Processos', plano_acao: 'Plano revisto', observacao: 'Falha revisada',
    });
    expect(finish.status).toBe(200);
    for (const [versao, situacao] of [[2, 'CONCLUIDA'], [3, 'PENDENTE'], [4, 'CANCELADA']]) {
      const updated = await call('/acoes/' + action.id, 'PATCH', { versao, situacao });
      expect(updated.status).toBe(200);
      const { acao } = await updated.json();
      expect(acao).toMatchObject({ situacao, data_origem: '2026-09-10', criado_por_login: 'COORD-FIXTURE' });
      if (situacao === 'CONCLUIDA') expect(acao.concluido_em).toBeTruthy();
      else expect(acao.concluido_em).toBeNull();
    }
    const listStatus = async (status?: string) => (await (await call('/acoes' + (status ? '?status=' + status : ''))).json()).acoes;
    expect(await listStatus()).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: action.id })]));
    expect(await listStatus('CANCELADA')).toEqual(expect.arrayContaining([expect.objectContaining({ id: action.id })]));
    expect(await listStatus('TODAS')).toEqual(expect.arrayContaining([expect.objectContaining({ id: action.id })]));
    const history = await call('/acoes/' + action.id + '/historico?limit=3');
    const page = await history.json();
    expect(page.eventos.map((event: { depois: { situacao: string } }) => event.depois.situacao)).toEqual(['CANCELADA', 'PENDENTE', 'CONCLUIDA']);
    const old = await call('/acoes/' + action.id + '/historico?cursor=' + page.proximoCursor);
    const earlier = (await old.json()).eventos;
    expect(earlier[0]).toMatchObject({ tipo: 'ALTERACAO', autor_login: 'COORD-FIXTURE',
      antes: { prazo: '2026-10-25', linha: 'GERAL', observacao: fixture.observacao },
      depois: { prazo: '2026-11-01', linha: 'TRI', situacao: 'EM_ANDAMENTO', observacao: 'Falha revisada' } });
    expect(earlier[1]).toMatchObject({ tipo: 'CRIACAO', antes: null });
    expect((await call('/acoes/' + action.id, 'PATCH', { versao: 5, data_origem: '2027-01-01', situacao: 'PENDENTE' })).status).toBe(400);
  });

  it('recusa escopo/data/paginação inválidos e exige perfil de Coordenação em todas as rotas', async () => {
    const id = randomUUID();
    const cases = [
      ['/acoes', 'GET'], ['/acoes', 'POST'], ['/acoes/' + id, 'GET'], ['/acoes/' + id, 'PATCH'],
      ['/acoes/' + id, 'DELETE'], ['/acoes/' + id + '/historico', 'GET'],
      ['/observacoes', 'GET'], ['/observacoes', 'PUT'],
    ];
    for (const [path, method] of cases) {
      expect((await call(path, method, undefined, '')).status).toBe(401);
      expect((await call(path, method, undefined, authorization('APONTADOR'))).status).toBe(403);
    }
    expect((await call('/acoes', 'POST', { ...fixture, prazo: '2026-02-29' })).status).toBe(400);
    expect((await call('/acoes', 'POST', { ...fixture, setor: 'EPOXI', linha: 'TRI' })).status).toBe(400);
    expect((await call('/acoes', 'POST', { ...fixture, situacao: 'VENCIDA' })).status).toBe(400);
    expect((await call('/acoes?limit=1000')).status).toBe(400);
    expect((await call('/acoes?cursor=invalido')).status).toBe(400);
    expect((await call('/acoes/' + id + '/historico')).status).toBe(404);
  });

  it('permite apenas uma alteração por versão e torna criação repetida idempotente', async () => {
    const fields = { ...fixture, data_origem: '2026-10-21', chave_requisicao: randomUUID() };
    const results = await Promise.all([call('/acoes', 'POST', fields), call('/acoes', 'POST', fields)]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 201]);
    const path = '/acoes/' + fields.chave_requisicao;
    const race = await Promise.all([
      call(path, 'PATCH', { versao: 1, situacao: 'EM_ANDAMENTO' }),
      call(path, 'PATCH', { versao: 1, situacao: 'CONCLUIDA' }),
    ]);
    expect(race.map((response) => response.status).sort()).toEqual([200, 409]);
    const fresh = await call(path);
    expect((await fresh.json()).acao.versao).toBe(2);
    const history = await call(path + '/historico');
    expect((await history.json()).eventos).toHaveLength(2);
    expect((await call('/acoes', 'POST', { ...fields, observacao: 'Outro problema' })).status).toBe(409);
  });

  it('mantém plano legado separado da nota coincidente e permite vincular texto explicitamente', async () => {
    const path = '/acoes/' + legacyActionId;
    const initial = (await (await call(path)).json()).acao;
    expect(initial).toMatchObject({ id: legacyActionId, observacao: null, plano_acao: 'Plano histórico', versao: 1 });
    const scoped = await (await call('/acoes?dataOrigem=2026-11-09&setor=MONTAGEM+FINAL')).json();
    expect(scoped.acoes).toEqual([initial]);
    const status = await call(path, 'PATCH', { versao: 1, situacao: 'EM_ANDAMENTO' });
    expect((await status.json()).acao).toMatchObject({ id: legacyActionId, observacao: null, versao: 2 });
    const link = await call(path, 'PATCH', { versao: 2, observacao: '  Investigação retrospectiva  ' });
    expect((await link.json()).acao).toMatchObject({ id: legacyActionId, observacao: 'Investigação retrospectiva', versao: 3 });
    expect((await call(path, 'PATCH', { versao: 3, observacao: null })).status).toBe(200);
    const history = (await (await call(path + '/historico')).json()).eventos;
    expect(history[0]).toMatchObject({ antes: { observacao: 'Investigação retrospectiva' }, depois: { observacao: null } });
    expect(history[1]).toMatchObject({ antes: { observacao: null }, depois: { observacao: 'Investigação retrospectiva' } });
    expect(history[3].depois).not.toHaveProperty('observacao');
  });

  it('salva com campos opcionais e pagina do prazo preenchido aos registros sem prazo', async () => {
    const scope = { data_origem: '2026-10-26', setor: 'MPA', linha: 'GERAL' };
    const empty = { observacao: null, plano_acao: null, responsavel: null, prazo: null };
    const request = { ...scope, chave_requisicao: randomUUID() };
    const response = await call('/acoes', 'POST', request);
    expect(response.status).toBe(201);
    const { acao } = await response.json();
    expect(acao).toMatchObject({ ...empty, situacao: 'PENDENTE' });
    expect((await call('/acoes', 'POST', request)).status).toBe(200);
    const note = await create({ ...scope, ...empty, observacao: '  Só observação  ' });
    expect(note).toMatchObject({ ...empty, observacao: 'Só observação' });
    const withDate = await create({ ...scope, ...empty, prazo: '2026-10-30' });
    const page = '/acoes?dataOrigem=2026-10-26&setor=MPA&limit=1';
    const first = await (await call(page)).json();
    const second = await (await call(page + '&cursor=' + first.proximoCursor)).json();
    const third = await (await call(page + '&cursor=' + second.proximoCursor)).json();
    expect(first.acoes[0].id).toBe(withDate.id);
    expect([second.acoes[0].id, third.acoes[0].id].sort()).toEqual([note.id, acao.id].sort());
    expect(third.proximoCursor).toBeNull();
    const clear = await call('/acoes/' + withDate.id, 'PATCH', { versao: 1, ...empty, prazo: '' });
    expect(clear.status).toBe(200);
    expect((await clear.json()).acao).toMatchObject(empty);
  });

  it('rejeita campos inválidos e não cria ação nem trilha parcial', async () => {
    const before = await db.query('SELECT count(*) total FROM producao_diaria_acoes_historico');
    const id = randomUUID();
    const payload = { ...fixture, chave_requisicao: id };
    for (const invalid of [{ observacao: 'x'.repeat(3001) }, { plano_acao: 2 }, { responsavel: 'x'.repeat(201) }, { prazo: '2026-02-29' }]) {
      expect((await call('/acoes', 'POST', { ...payload, ...invalid })).status).toBe(400);
    }
    const brokenActor = 'Bearer ' + jwt.sign({ userId: 999, login: 'INEXISTENTE', perfil: 'COORDENACAO' }, secret);
    expect((await call('/acoes', 'POST', payload, brokenActor)).status).toBe(500);
    expect((await call('/acoes/' + id)).status).toBe(404);
    expect((await db.query('SELECT count(*) total FROM producao_diaria_acoes_historico')).rows).toEqual(before.rows);
  });

  it('reverte mutação e evento juntos e impede reescrita do histórico pelo banco', async () => {
    const action = await create({ data_origem: '2026-10-24' });
    await db.exec('BEGIN');
    await db.query("UPDATE producao_diaria_acoes SET prazo='2026-12-21' WHERE id=$1", [action.id]);
    await db.exec('ROLLBACK');
    const history = await call('/acoes/' + action.id + '/historico');
    expect((await history.json()).eventos).toHaveLength(1);
    await expect(db.exec('UPDATE producao_diaria_acoes_historico SET autor_login = autor_login')).rejects.toThrow('só permite inclusão');
    await expect(db.exec('DELETE FROM producao_diaria_observacoes_historico WHERE false')).rejects.toThrow('só permite inclusão');
    await expect(db.query("UPDATE producao_diaria_acoes SET data_origem='2026-01-01' WHERE id=$1", [action.id])).rejects.toThrow('origem e a autoria');
  });

  it('exclui apenas a ação selecionada, preserva o histórico e protege contra versões antigas', async () => {
    const scope = { data_origem: '2026-10-27', setor: 'SOLDA', linha: 'MON' };
    const action = await create(scope);
    const other = await create(scope);
    const path = '/acoes/' + action.id;
    expect((await call(path, 'DELETE', { versao: 0 })).status).toBe(400);
    expect((await call(path, 'DELETE', { versao: 2 })).status).toBe(409);
    expect((await call(path, 'GET')).status).toBe(200);
    const deletes = await Promise.all([call(path, 'DELETE', { versao: 1 }), call(path, 'DELETE', { versao: 1 })]);
    expect(deletes.map(res => res.status).sort()).toEqual([204, 404]);
    expect((await call(path)).status).toBe(404);
    expect((await call(path, 'PATCH', { versao: 2, situacao: 'CONCLUIDA' })).status).toBe(404);
    const page = await (await call('/acoes?status=TODAS&dataOrigem=2026-10-27')).json();
    expect(page.acoes.map((row: { id: string }) => row.id)).toEqual([other.id]);
    const history = await (await call(path + '/historico')).json();
    expect(history.eventos.map((event: { tipo: string }) => event.tipo)).toEqual(['EXCLUSAO', 'CRIACAO']);
    expect(history.eventos[0]).toMatchObject({
      autor_login: 'COORD-FIXTURE',
      antes: { excluida_em: null, versao: 1 },
      depois: { excluida_em: expect.any(String), versao: 2, observacao: fixture.observacao },
    });
  });
});
