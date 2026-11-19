import type { Application, Request, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';
import {
  ACTION_PLAN_LIMIT, ACTION_RESPONSIBLE_LIMIT, isActionStatus,
  type ActionFields, type DailyAction,
} from './src/producao-diaria/acoes.js';
import {
  isDailyLine, isDailySector, isValidDailyObservationDate, isValidDailyObservationScope,
} from './src/producao-diaria/escopo.js';

const route = '/api/coordenacao/producao-diaria/acoes';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const columns = `
  a.id, a.data_origem::text, a.setor, a.linha, a.plano_acao, a.responsavel,
  a.prazo::text, a.situacao, a.criado_por_login, a.atualizado_por_login,
  a.criado_em, a.atualizado_em, a.concluido_em, a.versao
`;
const editable = ['setor', 'linha', 'plano_acao', 'responsavel', 'prazo', 'situacao'] as const;
type Actor = { userId: number; login: string };
type Cursor = [string, string, string];

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

function parseCursor(value: unknown): Cursor | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) return null;
  try {
    const cursor: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(cursor) || cursor.length !== 3) return null;
    const [prazo, origem, id] = cursor;
    if (isValidDailyObservationDate(prazo) && isValidDailyObservationDate(origem) && isUuid(id)) return [prazo, origem, id];
  } catch { /* O cliente receberá 400. */ }
  return null;
}

function encodeCursor({ prazo, data_origem, id }: DailyAction) {
  return Buffer.from(JSON.stringify([prazo, data_origem, id])).toString('base64url');
}

function parseLimit(value: unknown): number | null {
  if (value === undefined) return 25;
  if (typeof value !== 'string' || !/^[1-9]\d?$|^100$/.test(value)) return null;
  return Number(value);
}

function readFields(value: Record<string, unknown>): ActionFields | null {
  const { setor, linha, plano_acao, responsavel, prazo, situacao } = value;
  if (!isDailySector(setor) || !isDailyLine(linha) || !isValidDailyObservationScope(setor, linha)
    || !isValidDailyObservationDate(prazo) || !isActionStatus(situacao)
    || typeof plano_acao !== 'string' || !plano_acao.trim() || plano_acao.trim().length > ACTION_PLAN_LIMIT
    || typeof responsavel !== 'string' || !responsavel.trim() || responsavel.trim().length > ACTION_RESPONSIBLE_LIMIT
    || plano_acao.includes('\u0000') || responsavel.includes('\u0000')) return null;
  return { setor, linha, plano_acao: plano_acao.trim(), responsavel: responsavel.trim(), prazo, situacao };
}

function readActor(req: Request): Actor | null {
  const actor = (req as Request & { auth?: Actor }).auth;
  return actor && Number.isInteger(actor.userId) && actor.userId > 0 && typeof actor.login === 'string' && actor.login
    ? actor : null;
}

function unexpected(res: Response) {
  console.error('Falha na operação de ações da Produção Diária.');
  res.status(500).json({ error: 'Não foi possível concluir a operação de ações.' });
}

export function registerProducaoDiariaAcoesRoutes(
  app: Application, pool: Pool, auth: RequestHandler, requireCoordenacao: RequestHandler,
): void {
  const authorization = [auth, requireCoordenacao];

  app.get(route, ...authorization, async (req, res) => {
    const { status = 'ABERTAS', setor, linha, dataOrigem, incluirGeral, cursor } = req.query;
    const pageSize = parseLimit(req.query.limit);
    const position = cursor === undefined ? null : parseCursor(cursor);
    if ((!isActionStatus(status) && status !== 'TODAS' && status !== 'ABERTAS')
      || (setor !== undefined && !isDailySector(setor)) || (linha !== undefined && !isDailyLine(linha))
      || (dataOrigem !== undefined && !isValidDailyObservationDate(dataOrigem))
      || (incluirGeral !== undefined && incluirGeral !== 'true' && incluirGeral !== 'false')
      || !pageSize || (cursor !== undefined && !position)) {
      res.status(400).json({ error: 'Informe filtros e paginação válidos.' });
      return;
    }
    const values: unknown[] = [];
    const bind = (value: unknown) => '$' + values.push(value);
    const conditions: string[] = [];
    if (status === 'ABERTAS') conditions.push("a.situacao IN ('PENDENTE', 'EM_ANDAMENTO')");
    if (isActionStatus(status)) conditions.push(`a.situacao = ${bind(status)}`);
    if (setor) conditions.push(`a.setor = ${bind(setor)}`);
    if (linha) {
      const selected = bind(linha);
      conditions.push(incluirGeral === 'false' ? `a.linha = ${selected}` : `a.linha IN (${selected}, 'GERAL')`);
    }
    if (dataOrigem) conditions.push(`a.data_origem = ${bind(dataOrigem)}::date`);
    if (position) {
      conditions.push(`(a.prazo, a.data_origem, a.id) > (${bind(position[0])}::date, ${bind(position[1])}::date, ${bind(position[2])}::uuid)`);
    }
    try {
      const { rows } = await pool.query<DailyAction>(`
        SELECT ${columns}, o.observacao AS observacao_contexto
        FROM public.producao_diaria_acoes a
        LEFT JOIN public.producao_diaria_observacoes o
          ON (o.data, o.setor, o.linha) = (a.data_origem, a.setor, a.linha)
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY a.prazo, a.data_origem, a.id
        LIMIT ${bind(pageSize + 1)}
      `, values);
      const acoes = rows.slice(0, pageSize);
      res.json({ acoes, proximoCursor: rows.length > pageSize ? encodeCursor(acoes[acoes.length - 1]) : null });
    } catch { unexpected(res); }
  });

  app.post(route, ...authorization, async (req, res) => {
    const actor = readActor(req);
    const body = req.body || {};
    const { data_origem, chave_requisicao } = body;
    const fields = readFields({ ...body, situacao: body.situacao === undefined ? 'PENDENTE' : body.situacao });
    if (!actor) { res.status(401).json({ error: 'Sessão inválida.' }); return; }
    if (!fields || !isValidDailyObservationDate(data_origem)
      || (chave_requisicao !== undefined && !isUuid(chave_requisicao))) {
      res.status(400).json({ error: 'Informe origem, setor, linha, plano, responsável, prazo e situação válidos.' });
      return;
    }
    try {
      const result = await pool.query<DailyAction>(`
        INSERT INTO public.producao_diaria_acoes AS a
          (id, data_origem, setor, linha, plano_acao, responsavel, prazo, situacao, concluido_em,
           criado_por_id, criado_por_login, atualizado_por_id, atualizado_por_login)
        VALUES (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
                CASE WHEN $8 = 'CONCLUIDA' THEN now() END, $9, $10, $9, $10)
        ON CONFLICT (id) DO NOTHING
        RETURNING ${columns}
      `, [chave_requisicao ?? null, data_origem, fields.setor, fields.linha, fields.plano_acao,
        fields.responsavel, fields.prazo, fields.situacao, actor.userId, actor.login]);
      if (result.rows[0]) { res.status(201).json({ acao: result.rows[0] }); return; }

      // A repetição de uma solicitação confirmada não duplica a ação nem o evento.
      const original = await pool.query<DailyAction>(`
        SELECT ${columns}
          FROM public.producao_diaria_acoes a
          JOIN public.producao_diaria_acoes_historico h ON h.acao_id = a.id AND h.tipo = 'CRIACAO'
         WHERE a.id = $1 AND a.criado_por_id = $2 AND h.depois @> $3::jsonb
      `, [chave_requisicao, actor.userId, JSON.stringify({ ...fields, data_origem })]);
      if (original.rows[0]) { res.json({ acao: original.rows[0] }); return; }
      res.status(409).json({ error: 'A chave desta solicitação já foi usada para outra ação.' });
    } catch { unexpected(res); }
  });

  const findAction = async (id: string) => {
    const { rows } = await pool.query<DailyAction>(
      `SELECT ${columns} FROM public.producao_diaria_acoes a WHERE a.id = $1`, [id],
    );
    return rows[0];
  };

  app.get(route + '/:id', ...authorization, async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) { res.status(400).json({ error: 'Informe uma ação válida.' }); return; }
    try {
      const acao = await findAction(id);
      if (!acao) { res.status(404).json({ error: 'Ação não encontrada.' }); return; }
      res.json({ acao });
    } catch { unexpected(res); }
  });

  app.patch(route + '/:id', ...authorization, async (req, res) => {
    const actor = readActor(req);
    const { id } = req.params;
    const body = req.body || {};
    const updates = Object.fromEntries(editable.filter((key) => Object.hasOwn(body, key)).map((key) => [key, body[key]]));
    if (!actor) { res.status(401).json({ error: 'Sessão inválida.' }); return; }
    if (!isUuid(id) || !Number.isInteger(body.versao) || body.versao < 1 || body.versao > 2147483647
      || !Object.keys(updates).length || Object.hasOwn(body, 'data_origem')) {
      res.status(400).json({ error: 'Informe a ação, sua versão e os campos a editar.' });
      return;
    }
    try {
      const current = await findAction(id);
      if (!current) { res.status(404).json({ error: 'Ação não encontrada.' }); return; }
      const conflict = () => res.status(409).json({ error: 'A ação foi atualizada. Recarregue a versão atual antes de salvar.' });
      if (current.versao !== body.versao) { conflict(); return; }
      const next = readFields({ ...current, ...updates });
      if (!next) { res.status(400).json({ error: 'Informe setor, linha, plano, responsável, prazo e situação válidos.' }); return; }
      if (editable.every((key) => next[key] === current[key])) { res.json({ acao: current }); return; }

      const { rows: [updated] } = await pool.query<DailyAction>(`
        UPDATE public.producao_diaria_acoes a
           SET setor = $3, linha = $4, plano_acao = $5, responsavel = $6, prazo = $7, situacao = $8,
               concluido_em = CASE WHEN $8 = 'CONCLUIDA' THEN coalesce(a.concluido_em, now()) END,
               atualizado_por_id = $9, atualizado_por_login = $10, atualizado_em = now(), versao = versao + 1
         WHERE a.id = $1 AND a.versao = $2
         RETURNING ${columns}
      `, [id, current.versao, next.setor, next.linha, next.plano_acao, next.responsavel,
        next.prazo, next.situacao, actor.userId, actor.login]);
      if (!updated) { conflict(); return; }
      res.json({ acao: updated });
    } catch { unexpected(res); }
  });

  app.get(route + '/:id/historico', ...authorization, async (req, res) => {
    const { id } = req.params;
    const { cursor } = req.query;
    const pageSize = parseLimit(req.query.limit);
    if (!isUuid(id) || !pageSize || (cursor !== undefined && (
      typeof cursor !== 'string' || !/^[1-9][0-9]{0,18}$/.test(cursor) || BigInt(cursor) > 9223372036854775807n
    ))) {
      res.status(400).json({ error: 'Informe ação e paginação válidas.' });
      return;
    }
    try {
      const { rows } = await pool.query(`
        SELECT h.id::text, h.tipo, h.autor_login, h.criado_em, h.antes, h.depois
          FROM public.producao_diaria_acoes a
          LEFT JOIN LATERAL (
            SELECT * FROM public.producao_diaria_acoes_historico
             WHERE acao_id = a.id AND ($2::bigint IS NULL OR id < $2)
             ORDER BY id DESC LIMIT $3
          ) h ON true
         WHERE a.id = $1
         ORDER BY h.id DESC
      `, [id, cursor ?? null, pageSize + 1]);
      if (!rows.length) { res.status(404).json({ error: 'Ação não encontrada.' }); return; }
      const eventos = rows[0].id ? rows.slice(0, pageSize) : [];
      res.json({ eventos, proximoCursor: rows.length > pageSize ? eventos[eventos.length - 1].id : null });
    } catch { unexpected(res); }
  });
}
