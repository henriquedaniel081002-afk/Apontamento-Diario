import express from 'express';
import dotenv from 'dotenv';
import pg from 'pg';
import jwt from 'jsonwebtoken';

dotenv.config();
const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';
if (!DATABASE_URL) throw new Error('DATABASE_URL não configurada.');

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
app.use(express.json({ limit: '1mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

type Perfil = 'APONTADOR' | 'COORDENACAO';
type TokenPayload = { userId: number; login: string; perfil?: Perfil };

function auth(req: any, res: any, next: any) {
  const value = req.headers.authorization || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  try {
    req.auth = jwt.verify(token, SESSION_SECRET) as TokenPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

function requireCoordenacao(req: any, res: any, next: any) {
  if (req.auth?.perfil !== 'COORDENACAO') {
    return res.status(403).json({ error: 'Acesso permitido somente para a COORDENAÇÃO.' });
  }
  next();
}

function dateOnly(value: any) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

function isoDateTime(value: any) {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value ?? '') : d.toISOString();
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });

  try {
    const result = await pool.query('SELECT * FROM autenticar_usuario($1, $2)', [login, password]);
    if (!result.rows.length) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

    const first = result.rows[0];
    const perfil = (first.perfil || 'APONTADOR') as Perfil;
    const linhas = [
      ...new Set(
        result.rows
          .map((r: any) => r.linha)
          .filter((linha: any) => typeof linha === 'string' && linha.trim().length > 0),
      ),
    ];

    const user = {
      id: String(first.usuario_id),
      name: first.login,
      perfil,
      setor: first.setor || null,
      linhas,
    };

    const token = jwt.sign(
      { userId: Number(first.usuario_id), login: first.login, perfil },
      SESSION_SECRET,
      { expiresIn: '12h' },
    );

    res.json({ user, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao autenticar.' });
  }
});

async function getUserAccess(userId: number) {
  const r = await pool.query(
    `SELECT s.id setor_id, s.nome setor, l.id linha_id, l.nome linha
       FROM usuario_acessos ua
       JOIN setores s ON s.id = ua.setor_id
       JOIN linhas l ON l.id = ua.linha_id
      WHERE ua.usuario_id = $1`,
    [userId],
  );
  return r.rows;
}


type ImportLine = 'MON' | 'TRI' | 'EPO';
type ImportGroup = {
  setor: string;
  linha: ImportLine;
  potencia: number;
  quantidade: number;
  tipoBobina?: 'AT' | 'BT';
};

type PreparedImportGroup = ImportGroup & {
  setorId: number;
  linhaId: number;
  usuarioId: number;
};

const IMPORT_SECTORS = new Set([
  'BOBINA AT/BT',
  'CORTE LASER',
  'ISOLANTE',
  'MONTAGEM NUCLEO',
  'MONTAGEM FINAL',
  'MPA',
  'PINTURA',
  'SOLDA',
  'EPOXI',
]);
const IMPORT_LINES = new Set<ImportLine>(['MON', 'TRI', 'EPO']);

function importUnitKey(group: Pick<ImportGroup, 'setor' | 'linha' | 'tipoBobina'>): string {
  if (group.setor === 'BOBINA AT/BT') return `${group.setor}|${group.tipoBobina || ''}`;
  if (group.setor === 'MONTAGEM FINAL' || group.setor === 'MPA') return `${group.setor}|${group.linha}`;
  return group.setor;
}

function validateImportGroups(value: unknown): ImportGroup[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('A importação não possui grupos de produção válidos.');
  }

  return value.map((item: any) => {
    const setor = String(item?.setor || '').trim().toUpperCase();
    const linha = String(item?.linha || '').trim().toUpperCase() as ImportLine;
    const potencia = Number(item?.potencia);
    const quantidade = Number(item?.quantidade);
    const tipoBobina = String(item?.tipoBobina || '').trim().toUpperCase();

    if (!IMPORT_SECTORS.has(setor)) throw new Error(`Setor de importação inválido: ${setor || 'não informado'}.`);
    if (!IMPORT_LINES.has(linha)) throw new Error(`Linha de importação inválida: ${linha || 'não informada'}.`);
    if (!Number.isFinite(potencia) || potencia <= 0) throw new Error('A potência importada precisa ser maior que zero.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error('A quantidade importada precisa ser um inteiro maior que zero.');
    if (setor === 'EPOXI' && linha !== 'EPO') throw new Error('Epóxi aceita somente registros da linha EPO.');
    if (setor !== 'EPOXI' && linha === 'EPO') throw new Error('Registros da linha EPO devem ser direcionados ao Epóxi.');
    if (setor === 'BOBINA AT/BT' && !['AT', 'BT'].includes(tipoBobina)) {
      throw new Error('A produção de Bobinagem precisa identificar AT ou BT.');
    }

    return {
      setor,
      linha,
      potencia,
      quantidade,
      tipoBobina: setor === 'BOBINA AT/BT' ? tipoBobina as 'AT' | 'BT' : undefined,
    };
  });
}

async function prepareImportGroups(client: any, groups: ImportGroup[]): Promise<PreparedImportGroup[]> {
  const sectorNames = [...new Set(groups.map((group) => group.setor))];
  const lineNames = [...new Set(groups.map((group) => group.linha))];
  const [sectorsResult, linesResult, accessResult] = await Promise.all([
    client.query('SELECT id, nome FROM setores WHERE nome = ANY($1::text[])', [sectorNames]),
    client.query('SELECT id, nome FROM linhas WHERE nome = ANY($1::text[])', [lineNames]),
    client.query(
      `SELECT ua.usuario_id, u.login, ua.setor_id, s.nome setor, ua.linha_id, l.nome linha
         FROM usuario_acessos ua
         JOIN usuarios u ON u.id = ua.usuario_id
         JOIN setores s ON s.id = ua.setor_id
         JOIN linhas l ON l.id = ua.linha_id
        WHERE s.nome = ANY($1::text[])
        ORDER BY ua.usuario_id, ua.setor_id, l.nome`,
      [sectorNames],
    ),
  ]);

  const sectorMap = new Map<string, number>(sectorsResult.rows.map((row: any) => [String(row.nome), Number(row.id)]));
  const lineMap = new Map<string, number>(linesResult.rows.map((row: any) => [String(row.nome), Number(row.id)]));
  for (const sector of sectorNames) if (!sectorMap.has(sector)) throw new Error(`Setor ${sector} não encontrado no Neon.`);
  for (const line of lineNames) if (!lineMap.has(line)) throw new Error(`Linha ${line} não encontrada no Neon.`);

  const accessByUserSector = new Map<string, { usuarioId: number; setor: string; setorId: number; lines: Map<string, number> }>();
  for (const row of accessResult.rows) {
    const key = `${row.usuario_id}|${row.setor_id}`;
    let access = accessByUserSector.get(key);
    if (!access) {
      access = {
        usuarioId: Number(row.usuario_id),
        setor: String(row.setor),
        setorId: Number(row.setor_id),
        lines: new Map(),
      };
      accessByUserSector.set(key, access);
    }
    access.lines.set(String(row.linha), Number(row.linha_id));
  }

  const units = new Map<string, ImportGroup[]>();
  for (const group of groups) {
    const key = importUnitKey(group);
    const bucket = units.get(key) || [];
    bucket.push(group);
    units.set(key, bucket);
  }

  const assignments = new Map<string, { usuarioId: number; setorId: number; lineIds: Map<string, number> }>();
  for (const [unitKey, unitGroups] of units) {
    const setor = unitGroups[0].setor;
    const neededLines = [...new Set(unitGroups.map((group) => group.linha))];
    const candidates = [...accessByUserSector.values()]
      .filter((access) => access.setor === setor && neededLines.every((line) => access.lines.has(line)))
      .sort((a, b) => {
        const exactA = a.lines.size === neededLines.length ? 0 : 1;
        const exactB = b.lines.size === neededLines.length ? 0 : 1;
        return exactA - exactB || a.lines.size - b.lines.size || a.usuarioId - b.usuarioId;
      });

    const selected = candidates[0];
    if (!selected) {
      const label = setor === 'BOBINA AT/BT'
        ? `BOBINA ${unitGroups[0].tipoBobina || ''}`
        : (setor === 'MONTAGEM FINAL' || setor === 'MPA') ? `${setor} ${unitGroups[0].linha}` : setor;
      throw new Error(`Nenhum apontador com acesso compatível foi encontrado para ${label}.`);
    }
    assignments.set(unitKey, { usuarioId: selected.usuarioId, setorId: selected.setorId, lineIds: selected.lines });
  }

  return groups.map((group) => {
    const assignment = assignments.get(importUnitKey(group));
    if (!assignment) throw new Error('Falha ao associar a produção importada ao apontador.');
    const linhaId = assignment.lineIds.get(group.linha) || lineMap.get(group.linha);
    if (!linhaId) throw new Error(`Linha ${group.linha} não disponível para o apontador selecionado.`);
    return { ...group, usuarioId: assignment.usuarioId, setorId: assignment.setorId, linhaId };
  });
}

async function loadApontamento(id: number) {
  const h = await pool.query(
    `SELECT a.id, a.data, a.usuario_id, a.setor_id, a.tipo_bobina, u.login usuario, s.nome setor,
            a.criado_em, a.atualizado_em, a.status_aprovacao, a.aprovado_em, a.aprovado_por,
            a.origem_producao, a.complementado, aprovador.login aprovado_por_nome
       FROM apontamentos a
       JOIN usuarios u ON u.id = a.usuario_id
       JOIN setores s ON s.id = a.setor_id
       LEFT JOIN usuarios aprovador ON aprovador.id = a.aprovado_por
      WHERE a.id = $1`,
    [id],
  );

  if (!h.rows.length) return null;
  const x = h.rows[0];

  const [p, material, maquina, nc, f, o, acessos] = await Promise.all([
    pool.query(
      `SELECT p.id, l.nome linha, p.potencia, p.quantidade
         FROM producao p
         JOIN linhas l ON l.id = p.linha_id
        WHERE p.apontamento_id = $1
        ORDER BY p.id`,
      [id],
    ),
    pool.query(
      `SELECT id, causa_motivo, material, hora_inicio, hora_fim
         FROM paradas_falta_material
        WHERE apontamento_id = $1
        ORDER BY id`,
      [id],
    ),
    pool.query(
      `SELECT id, maquina_equipamento, hora_inicio, hora_fim, observacao
         FROM paradas_maquina
        WHERE apontamento_id = $1
        ORDER BY id`,
      [id],
    ),
    pool.query(
      `SELECT id, causa_nao_conformidade, op, numero_serie
         FROM nao_conformidades
        WHERE apontamento_id = $1
        ORDER BY id`,
      [id],
    ),
    pool.query(
      `SELECT f.id, l.nome linha, f.turno, f.quantidade, f.justificativa,
              f.nome, f.motivo_justificativa, f.atestado
         FROM faltas f
         LEFT JOIN linhas l ON l.id = f.linha_id
        WHERE f.apontamento_id = $1
        ORDER BY f.id`,
      [id],
    ),
    pool.query(
      `SELECT o.id, l.nome linha, o.turno, o.observacao, o.justificativa_meta
         FROM observacoes o
         LEFT JOIN linhas l ON l.id = o.linha_id
        WHERE o.apontamento_id = $1
        ORDER BY o.id`,
      [id],
    ),
    pool.query(
      `SELECT DISTINCT l.nome linha
         FROM usuario_acessos ua
         JOIN linhas l ON l.id = ua.linha_id
        WHERE ua.usuario_id = $1 AND ua.setor_id = $2
        ORDER BY l.nome`,
      [x.usuario_id, x.setor_id],
    ),
  ]);

  const tipoBobina = ['AT', 'BT'].includes(String(x.tipo_bobina || '').toUpperCase())
    ? String(x.tipo_bobina).toUpperCase()
    : null;
  const setorExibicao = x.setor === 'BOBINA AT/BT' && tipoBobina ? `BOBINA ${tipoBobina}` : x.setor;
  const shortTime = (value: any) => String(value || '').slice(0, 5);

  return {
    id: String(x.id),
    data: dateOnly(x.data),
    setor: setorExibicao,
    tipoBobina: tipoBobina || undefined,
    userId: String(x.usuario_id),
    userName: x.usuario,
    linhasPermitidas: acessos.rows.map((r: any) => r.linha).filter(Boolean),
    producoes: p.rows.map((r: any) => ({
      id: String(r.id), linha: r.linha, potencia: Number(r.potencia),
      potenciaFormatted: String(r.potencia).replace('.', ','), quantidade: r.quantidade,
    })),
    paradasFaltaMaterial: material.rows.map((r: any) => ({
      id: String(r.id), causaMotivo: r.causa_motivo || '', material: r.material || '',
      horaInicio: shortTime(r.hora_inicio), horaFim: shortTime(r.hora_fim),
    })),
    paradasMaquina: maquina.rows.map((r: any) => ({
      id: String(r.id), maquinaEquipamento: r.maquina_equipamento || '',
      horaInicio: shortTime(r.hora_inicio), horaFim: shortTime(r.hora_fim), observacao: r.observacao || '',
    })),
    naoConformidades: nc.rows.map((r: any) => ({
      id: String(r.id), causaNaoConformidade: r.causa_nao_conformidade || '', op: r.op || '', numeroSerie: r.numero_serie || '',
    })),
    faltas: f.rows.map((r: any) => ({
      id: String(r.id),
      nome: r.nome || undefined,
      motivoJustificativa: r.motivo_justificativa || undefined,
      atestado: typeof r.atestado === 'boolean' ? r.atestado : undefined,
      linha: r.linha || undefined,
      turno: r.turno ? String(r.turno).toLowerCase() : undefined,
      quantidade: r.quantidade ?? undefined,
      justificativa: r.justificativa || undefined,
    })),
    observacoes: o.rows.map((r: any) => ({
      id: String(r.id), linha: r.linha || undefined,
      turno: r.turno ? String(r.turno).toLowerCase() : undefined,
      observacao: r.observacao || '', justificativaMeta: r.justificativa_meta || undefined,
    })),
    createdAt: isoDateTime(x.criado_em),
    updatedAt: isoDateTime(x.atualizado_em),
    statusAprovacao: String(x.status_aprovacao || 'PENDENTE').toUpperCase() === 'APROVADO' ? 'APROVADO' : 'PENDENTE',
    aprovadoEm: x.aprovado_em ? isoDateTime(x.aprovado_em) : undefined,
    aprovadoPorId: x.aprovado_por ? String(x.aprovado_por) : undefined,
    aprovadoPorNome: x.aprovado_por_nome || undefined,
    origemProducao: String(x.origem_producao || 'MANUAL').toUpperCase() === 'IMPORTADO' ? 'IMPORTADO' : 'MANUAL',
    complementado: x.complementado !== false,
  };
}

function occurrenceList(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function isLegacyFalta(item: any): boolean {
  return !String(item?.nome || '').trim() && Boolean(item?.linha || item?.turno || item?.quantidade || item?.justificativa);
}

function isLegacyObservacao(item: any): boolean {
  return !String(item?.justificativaMeta || '').trim() && Boolean(item?.linha || item?.turno);
}

function validateOccurrencePayload(_data: any): string | null {
  // As ocorrências aceitam preenchimento parcial. Nenhum campo individual é
  // obrigatório para adicionar/salvar um registro; os dados podem ser
  // complementados posteriormente.
  return null;
}

async function deleteOccurrenceCollections(client: any, apontamentoId: number, data: any) {
  // Substitui apenas coleções explicitamente enviadas. Isso mantém compatibilidade
  // com uma versão antiga do frontend eventualmente ainda aberta/em cache.
  const has = (key: string) => Object.prototype.hasOwnProperty.call(data || {}, key);
  if (has('paradasFaltaMaterial')) await client.query('DELETE FROM paradas_falta_material WHERE apontamento_id = $1', [apontamentoId]);
  if (has('paradasMaquina')) await client.query('DELETE FROM paradas_maquina WHERE apontamento_id = $1', [apontamentoId]);
  if (has('naoConformidades')) await client.query('DELETE FROM nao_conformidades WHERE apontamento_id = $1', [apontamentoId]);
  if (has('faltas')) await client.query('DELETE FROM faltas WHERE apontamento_id = $1', [apontamentoId]);
  if (has('observacoes')) await client.query('DELETE FROM observacoes WHERE apontamento_id = $1', [apontamentoId]);
}

async function insertOccurrenceCollections(client: any, apontamentoId: number, data: any, lineMap: Map<any, any>) {
  for (const item of occurrenceList(data.paradasFaltaMaterial)) {
    await client.query(
      `INSERT INTO paradas_falta_material(apontamento_id, causa_motivo, material, hora_inicio, hora_fim)
       VALUES($1, $2, $3, $4, $5)`,
      [apontamentoId, String(item.causaMotivo || '').trim(), String(item.material || '').trim(), item.horaInicio || null, item.horaFim || null],
    );
  }
  for (const item of occurrenceList(data.paradasMaquina)) {
    await client.query(
      `INSERT INTO paradas_maquina(apontamento_id, maquina_equipamento, hora_inicio, hora_fim, observacao)
       VALUES($1, $2, $3, $4, $5)`,
      [apontamentoId, String(item.maquinaEquipamento || '').trim(), item.horaInicio || null, item.horaFim || null, String(item.observacao || '').trim()],
    );
  }
  for (const item of occurrenceList(data.naoConformidades)) {
    await client.query(
      `INSERT INTO nao_conformidades(apontamento_id, causa_nao_conformidade, op, numero_serie)
       VALUES($1, $2, $3, $4)`,
      [apontamentoId, String(item.causaNaoConformidade || '').trim(), String(item.op || '').trim(), String(item.numeroSerie || '').trim()],
    );
  }
  for (const item of occurrenceList(data.faltas)) {
    if (isLegacyFalta(item)) {
      await client.query(
        `INSERT INTO faltas(apontamento_id, linha_id, turno, quantidade, justificativa)
         VALUES($1, $2, $3, $4, $5)`,
        [apontamentoId, item.linha ? lineMap.get(item.linha) || null : null, item.turno ? String(item.turno).toUpperCase() : null, item.quantidade ?? null, item.justificativa || null],
      );
    } else {
      await client.query(
        `INSERT INTO faltas(apontamento_id, linha_id, turno, quantidade, justificativa, nome, motivo_justificativa, atestado)
         VALUES($1, NULL, NULL, NULL, NULL, $2, $3, $4)`,
        [apontamentoId, String(item.nome || '').trim() || null, String(item.motivoJustificativa || '').trim() || null, typeof item.atestado === 'boolean' ? item.atestado : null],
      );
    }
  }
  for (const item of occurrenceList(data.observacoes)) {
    if (isLegacyObservacao(item)) {
      await client.query(
        `INSERT INTO observacoes(apontamento_id, linha_id, turno, observacao)
         VALUES($1, $2, $3, $4)`,
        [apontamentoId, item.linha ? lineMap.get(item.linha) || null : null, item.turno ? String(item.turno).toUpperCase() : null, item.observacao || null],
      );
    } else {
      await client.query(
        `INSERT INTO observacoes(apontamento_id, linha_id, turno, observacao, justificativa_meta)
         VALUES($1, NULL, NULL, $2, $3)`,
        [apontamentoId, String(item.observacao || '').trim(), String(item.justificativaMeta || '').trim() || null],
      );
    }
  }
}

app.get('/api/apontamentos', auth, async (req: any, res) => {
  try {
    const ids = await pool.query(
      `SELECT id
         FROM apontamentos
        WHERE usuario_id = $1
          AND NOT (origem_producao = 'IMPORTADO' AND complementado = FALSE)
        ORDER BY data DESC, id DESC`,
      [req.auth.userId],
    );
    const registros = await Promise.all(ids.rows.map((r: any) => loadApontamento(r.id)));
    res.json(registros.filter(Boolean));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar histórico.' });
  }
});

app.get('/api/apontamentos/importados/pendentes', auth, async (req: any, res) => {
  if (req.auth?.perfil === 'COORDENACAO') return res.json([]);
  try {
    const ids = await pool.query(
      `SELECT id
         FROM apontamentos
        WHERE usuario_id = $1
          AND origem_producao = 'IMPORTADO'
          AND complementado = FALSE
        ORDER BY data DESC, id DESC`,
      [req.auth.userId],
    );
    const registros = await Promise.all(ids.rows.map((row: any) => loadApontamento(row.id)));
    res.json(registros.filter(Boolean));
  } catch (e: any) {
    console.error(e);
    if (e?.code === '42703') {
      return res.status(500).json({ error: 'Execute o script NEON_IMPORTACAO_PRODUCAO.sql no Neon antes de usar a importação.' });
    }
    res.status(500).json({ error: 'Falha ao carregar produções aguardando complemento.' });
  }
});

app.get('/api/apontamentos/data/:data', auth, async (req: any, res) => {
  try {
    const r = await pool.query(
      'SELECT id FROM apontamentos WHERE usuario_id = $1 AND data = $2 LIMIT 1',
      [req.auth.userId, req.params.data],
    );
    res.json(r.rows.length ? await loadApontamento(r.rows[0].id) : null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar apontamento.' });
  }
});

app.post('/api/apontamentos', auth, async (_req: any, res) => {
  // O novo fluxo não permite criação manual de produção pelo apontador.
  // Mantemos a rota apenas para devolver uma mensagem clara a clientes antigos/em cache.
  return res.status(409).json({
    error: 'A produção deve ser importada pela Coordenação. Complete apenas as ocorrências do registro disponibilizado.',
  });
});

// Complementa uma produção previamente importada pela Coordenação.
// O apontador pode alterar somente as ocorrências; produção e data permanecem bloqueadas.
app.put('/api/apontamentos/:id/complemento', auth, async (req: any, res) => {
  if (req.auth?.perfil === 'COORDENACAO') {
    return res.status(403).json({ error: 'A COORDENAÇÃO não utiliza o fluxo de complemento do apontador.' });
  }

  const client = await pool.connect();
  const id = Number(req.params.id);
  const data = req.body || {};
  try {
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Apontamento inválido.' });
    const validation = validateOccurrencePayload(data);
    if (validation) return res.status(400).json({ error: validation });

    const current = await client.query(
      `SELECT id, usuario_id, setor_id, origem_producao
         FROM apontamentos
        WHERE id = $1 AND usuario_id = $2`,
      [id, req.auth.userId],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Produção importada não encontrada.' });
    if (String(current.rows[0].origem_producao || '').toUpperCase() !== 'IMPORTADO') {
      return res.status(400).json({ error: 'Este registro não foi criado por importação de produção.' });
    }

    const access = await getUserAccess(req.auth.userId);
    const setorId = Number(current.rows[0].setor_id);
    const allowed = new Map(
      access.filter((row: any) => Number(row.setor_id) === setorId).map((row: any) => [row.linha, row.linha_id]),
    );
    const lineBearingItems = [...occurrenceList(data.faltas), ...occurrenceList(data.observacoes)];
    for (const item of lineBearingItems) {
      if (item.linha && !allowed.has(item.linha)) {
        return res.status(403).json({ error: `Linha ${item.linha} não permitida para este usuário/setor.` });
      }
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE apontamentos
          SET complementado = TRUE,
              atualizado_em = NOW(),
              status_aprovacao = 'PENDENTE',
              aprovado_em = NULL,
              aprovado_por = NULL
        WHERE id = $1 AND usuario_id = $2`,
      [id, req.auth.userId],
    );
    await deleteOccurrenceCollections(client, id, data);
    await insertOccurrenceCollections(client, id, data, allowed);
    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    if (e?.code === '42P01' || e?.code === '42703') {
      return res.status(500).json({ error: 'A estrutura de ocorrências do Neon não está atualizada. Execute o SQL de migração das novas ocorrências.' });
    }
    res.status(500).json({ error: 'Falha ao salvar as ocorrências do apontamento.' });
  } finally {
    client.release();
  }
});

// Edição do próprio apontamento. O usuário só pode alterar registros vinculados ao próprio usuário.
app.put('/api/apontamentos/:id', auth, async (req: any, res) => {
  if (req.auth?.perfil === 'COORDENACAO') {
    return res.status(403).json({ error: 'A COORDENAÇÃO deve editar registros pela tela de consulta geral.' });
  }

  const client = await pool.connect();
  const data = req.body || {};
  const id = Number(req.params.id);
  try {
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Apontamento inválido.' });
    if (!data.data) return res.status(400).json({ error: 'A data é obrigatória.' });
    const validation = validateOccurrencePayload(data);
    if (validation) return res.status(400).json({ error: validation });

    const current = await client.query(
      'SELECT id, usuario_id, setor_id, data, origem_producao FROM apontamentos WHERE id = $1 AND usuario_id = $2',
      [id, req.auth.userId],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Registro não encontrado ou sem permissão para edição.' });

    const access = await getUserAccess(req.auth.userId);
    if (!access.length) return res.status(403).json({ error: 'Usuário sem acesso configurado.' });
    const setorId = current.rows[0].setor_id;
    const allowed = new Map(access.filter((a: any) => Number(a.setor_id) === Number(setorId)).map((a: any) => [a.linha, a.linha_id]));
    const isImported = String(current.rows[0].origem_producao || '').toUpperCase() === 'IMPORTADO';
    const lineBearingItems = [
      ...(isImported ? [] : occurrenceList(data.producoes)),
      ...occurrenceList(data.faltas),
      ...occurrenceList(data.observacoes),
    ];
    for (const item of lineBearingItems) {
      if (item.linha && !allowed.has(item.linha)) {
        return res.status(403).json({ error: `Linha ${item.linha} não permitida para este usuário/setor.` });
      }
    }

    await client.query('BEGIN');
    const nextDate = isImported ? dateOnly(current.rows[0].data) : data.data;
    await client.query(
      `UPDATE apontamentos
          SET data = $1,
              complementado = CASE WHEN origem_producao = 'IMPORTADO' THEN TRUE ELSE complementado END,
              atualizado_em = NOW(),
              status_aprovacao = 'PENDENTE',
              aprovado_em = NULL,
              aprovado_por = NULL
        WHERE id = $2 AND usuario_id = $3`,
      [nextDate, id, req.auth.userId],
    );

    if (!isImported) {
      await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
      for (const item of occurrenceList(data.producoes)) {
        await client.query(
          'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade) VALUES($1, $2, $3, $4)',
          [id, allowed.get(item.linha), item.potencia, item.quantidade],
        );
      }
    }
    await deleteOccurrenceCollections(client, id, data);
    await insertOccurrenceCollections(client, id, data, allowed);
    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    if (e?.code === '23505') return res.status(409).json({ error: 'Já existe um apontamento desse usuário/setor para a data informada.' });
    res.status(500).json({ error: 'Falha ao editar apontamento.' });
  } finally {
    client.release();
  }
});

app.delete('/api/apontamentos/:id', auth, async (req: any, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM apontamentos WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [req.params.id, req.auth.userId],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao excluir apontamento.' });
  }
});

// Importa a produção agregada no navegador e associa cada unidade ao apontador correto.
app.post('/api/coordenacao/importar-producao', auth, requireCoordenacao, async (req: any, res) => {
  const client = await pool.connect();
  const data = String(req.body?.data || '').trim();
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'Informe uma data válida para a importação.' });

    let groups: ImportGroup[];
    try {
      groups = validateImportGroups(req.body?.grupos);
    } catch (validationError) {
      return res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Dados de importação inválidos.' });
    }

    await client.query('BEGIN');
    const prepared = await prepareImportGroups(client, groups);
    const unitGroups = new Map<string, PreparedImportGroup[]>();
    for (const group of prepared) {
      const key = `${group.usuarioId}|${group.setorId}|${importUnitKey(group)}`;
      const bucket = unitGroups.get(key) || [];
      bucket.push(group);
      unitGroups.set(key, bucket);
    }

    const usedIds = new Set<number>();
    for (const unit of unitGroups.values()) {
      const first = unit[0];
      const tipoBobina = first.setor === 'BOBINA AT/BT' ? first.tipoBobina || null : null;
      const existing = await client.query(
        `SELECT id, complementado
           FROM apontamentos
          WHERE data = $1
            AND usuario_id = $2
            AND setor_id = $3
            AND origem_producao = 'IMPORTADO'
            AND (($4::text IS NULL AND tipo_bobina IS NULL) OR tipo_bobina = $4)
          ORDER BY id DESC
          LIMIT 1`,
        [data, first.usuarioId, first.setorId, tipoBobina],
      );

      let apontamentoId: number;
      if (existing.rows.length) {
        apontamentoId = Number(existing.rows[0].id);
        await client.query('UPDATE apontamentos SET atualizado_em = NOW() WHERE id = $1', [apontamentoId]);
      } else {
        const inserted = await client.query(
          `INSERT INTO apontamentos(data, usuario_id, setor_id, tipo_bobina, origem_producao, complementado)
           VALUES($1, $2, $3, $4, 'IMPORTADO', FALSE)
           RETURNING id`,
          [data, first.usuarioId, first.setorId, tipoBobina],
        );
        apontamentoId = Number(inserted.rows[0].id);
      }

      usedIds.add(apontamentoId);
      await client.query('DELETE FROM producao WHERE apontamento_id = $1', [apontamentoId]);
      for (const group of unit) {
        await client.query(
          'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade) VALUES($1, $2, $3, $4)',
          [apontamentoId, group.linhaId, group.potencia, group.quantidade],
        );
      }
    }

    // A importação mais recente substitui integralmente a produção importada da data.
    // Se o apontador já complementou um registro que deixou de existir no novo Excel,
    // preservamos ocorrências/aprovação e removemos somente a produção antiga.
    const previous = await client.query(
      `SELECT a.id,
              a.complementado,
              (
                EXISTS (SELECT 1 FROM paradas_falta_material pfm WHERE pfm.apontamento_id = a.id)
                OR EXISTS (SELECT 1 FROM paradas_maquina pm WHERE pm.apontamento_id = a.id)
                OR EXISTS (SELECT 1 FROM nao_conformidades nc WHERE nc.apontamento_id = a.id)
                OR EXISTS (SELECT 1 FROM faltas f WHERE f.apontamento_id = a.id)
                OR EXISTS (SELECT 1 FROM observacoes o WHERE o.apontamento_id = a.id)
              ) AS possui_complementos
         FROM apontamentos a
        WHERE a.data = $1 AND a.origem_producao = 'IMPORTADO'`,
      [data],
    );
    for (const row of previous.rows) {
      const id = Number(row.id);
      if (usedIds.has(id)) continue;

      // Nunca apaga informações digitadas pelos apontadores. Um registro ainda
      // não finalizado só é removido quando não possui nenhum complemento manual.
      if (row.complementado === false && row.possui_complementos !== true) {
        await client.query('DELETE FROM apontamentos WHERE id = $1', [id]);
        continue;
      }

      await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
      await client.query('UPDATE apontamentos SET atualizado_em = NOW() WHERE id = $1', [id]);
    }

    await client.query('COMMIT');
    const ids = [...usedIds];
    const registros = await Promise.all(ids.map((id) => loadApontamento(id)));
    res.json({
      data,
      registros: registros.filter(Boolean),
      totalQuantidade: groups.reduce((sum, group) => sum + group.quantidade, 0),
      totalUnidades: unitGroups.size,
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error(e);
    if (e?.code === '42703') {
      return res.status(500).json({ error: 'Execute o script NEON_IMPORTACAO_PRODUCAO.sql no Neon antes da primeira importação.' });
    }
    res.status(500).json({ error: e instanceof Error ? e.message : 'Falha ao importar a produção.' });
  } finally {
    client.release();
  }
});

// Painel exclusivo da COORDENAÇÃO: consulta global.
app.get('/api/coordenacao/apontamentos', auth, requireCoordenacao, async (_req: any, res) => {
  try {
    const ids = await pool.query('SELECT id FROM apontamentos ORDER BY data DESC, id DESC');
    const registros = await Promise.all(ids.rows.map((r: any) => loadApontamento(r.id)));
    res.json(registros.filter(Boolean));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar os apontamentos gerais.' });
  }
});

// Edição global de um apontamento existente. Mantém o usuário e o setor originais.
app.put('/api/coordenacao/apontamentos/:id', auth, requireCoordenacao, async (req: any, res) => {
  const client = await pool.connect();
  const data = req.body || {};
  const id = Number(req.params.id);

  try {
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Apontamento inválido.' });
    if (!data.data) return res.status(400).json({ error: 'A data é obrigatória.' });
    const validation = validateOccurrencePayload(data);
    if (validation) return res.status(400).json({ error: validation });

    const current = await client.query(
      'SELECT id, usuario_id, setor_id, data, origem_producao FROM apontamentos WHERE id = $1',
      [id],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Registro não encontrado.' });

    const isImported = String(current.rows[0].origem_producao || '').toUpperCase() === 'IMPORTADO';
    const lineBearingItems = [
      ...(isImported ? [] : occurrenceList(data.producoes)),
      ...occurrenceList(data.faltas),
      ...occurrenceList(data.observacoes),
    ];
    const lineNames = [...new Set(lineBearingItems.map((item: any) => item.linha).filter(Boolean))];
    const lines = lineNames.length
      ? await client.query('SELECT id, nome FROM linhas WHERE nome = ANY($1::text[])', [lineNames])
      : { rows: [] as any[] };
    const lineMap = new Map(lines.rows.map((r: any) => [r.nome, r.id]));
    for (const name of lineNames) {
      if (!lineMap.has(name)) return res.status(400).json({ error: `Linha ${name} não encontrada no banco.` });
    }

    await client.query('BEGIN');
    const nextDate = isImported ? dateOnly(current.rows[0].data) : data.data;
    await client.query(
      `UPDATE apontamentos
          SET data = $1,
              complementado = CASE WHEN origem_producao = 'IMPORTADO' THEN TRUE ELSE complementado END,
              atualizado_em = NOW(),
              status_aprovacao = 'PENDENTE',
              aprovado_em = NULL,
              aprovado_por = NULL
        WHERE id = $2`,
      [nextDate, id],
    );

    if (!isImported) {
      await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
      for (const item of occurrenceList(data.producoes)) {
        await client.query(
          'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade) VALUES($1, $2, $3, $4)',
          [id, lineMap.get(item.linha), item.potencia, item.quantidade],
        );
      }
    }
    await deleteOccurrenceCollections(client, id, data);
    await insertOccurrenceCollections(client, id, data, lineMap);
    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    if (e?.code === '23505') return res.status(409).json({ error: 'Já existe um apontamento desse usuário/setor para a data informada.' });
    res.status(500).json({ error: 'Falha ao editar apontamento.' });
  } finally {
    client.release();
  }
});

app.patch('/api/coordenacao/apontamentos/:id/aprovacao', auth, requireCoordenacao, async (req: any, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '').toUpperCase();

  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Apontamento inválido.' });
  if (!['PENDENTE', 'APROVADO'].includes(status)) {
    return res.status(400).json({ error: 'Status de aprovação inválido.' });
  }

  try {
    if (status === 'APROVADO') {
      const readiness = await pool.query(
        'SELECT origem_producao, complementado FROM apontamentos WHERE id = $1',
        [id],
      );
      if (!readiness.rows.length) return res.status(404).json({ error: 'Registro não encontrado.' });
      if (String(readiness.rows[0].origem_producao || '').toUpperCase() === 'IMPORTADO' && readiness.rows[0].complementado === false) {
        return res.status(409).json({ error: 'Este registro ainda aguarda o apontador finalizar o complemento das ocorrências.' });
      }
    }

    const result = status === 'APROVADO'
      ? await pool.query(
        `UPDATE apontamentos
            SET status_aprovacao = 'APROVADO',
                aprovado_em = NOW(),
                aprovado_por = $1,
                atualizado_em = NOW()
          WHERE id = $2
          RETURNING id`,
        [req.auth.userId, id],
      )
      : await pool.query(
        `UPDATE apontamentos
            SET status_aprovacao = 'PENDENTE',
                aprovado_em = NULL,
                aprovado_por = NULL,
                atualizado_em = NOW()
          WHERE id = $1
          RETURNING id`,
        [id],
      );

    if (!result.rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json(await loadApontamento(id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao atualizar a aprovação do apontamento.' });
  }
});

app.delete('/api/coordenacao/apontamentos/:id', auth, requireCoordenacao, async (req: any, res) => {
  try {
    const r = await pool.query('DELETE FROM apontamentos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao excluir apontamento.' });
  }
});

// No Vercel, o Express é executado como uma Function e não deve abrir uma porta própria.
// Localmente, o servidor continua funcionando em http://localhost:3001.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`ITAM API em http://localhost:${PORT}`));
}

export default app;
