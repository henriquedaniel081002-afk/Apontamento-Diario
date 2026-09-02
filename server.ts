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
app.use(express.json({ limit: '5mb' }));
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

function displayLoginName(value: any): string {
  const login = String(value || '').trim();
  if (login.toUpperCase() === 'MPA MON/EPO') return 'MPA MON';
  if (login.toUpperCase() === 'CORTE LASER') return 'Corte do Laser/Ferragem';
  if (login.toUpperCase() === 'MONTAGEM NUCLEO') return 'Montagem do Núcleo/Corte do Núcleo';
  return login;
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
    let result = await pool.query('SELECT * FROM autenticar_usuario($1, $2)', [login, password]);
    // Compatibilidade: a interface exibe um nome composto, mas o usuário do Neon continua
    // cadastrado como "Montagem Nucleo".
    if (!result.rows.length && String(login).trim().toUpperCase() === 'MONTAGEM DO NÚCLEO/CORTE DO NÚCLEO') {
      result = await pool.query('SELECT * FROM autenticar_usuario($1, $2)', ['Montagem Nucleo', password]);
    }
    // Variante sem acentos para clientes antigos ou integrações externas.
    if (!result.rows.length && String(login).trim().toUpperCase() === 'MONTAGEM DO NUCLEO/CORTE DO NUCLEO') {
      result = await pool.query('SELECT * FROM autenticar_usuario($1, $2)', ['Montagem Nucleo', password]);
    }
    // Compatibilidade com bancos em que o login antigo ainda está salvo como MPA MON/EPO.
    // A interface e a sessão passam a exibir somente MPA MON, sem exigir renomear o usuário no Neon.
    if (!result.rows.length && String(login).trim().toUpperCase() === 'MPA MON') {
      result = await pool.query('SELECT * FROM autenticar_usuario($1, $2)', ['MPA MON/EPO', password]);
    }
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
      name: displayLoginName(first.login),
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
  turno?: '1º' | '2º';
};

type PreparedImportGroup = ImportGroup & {
  setorId: number;
  linhaId: number;
  usuarioId: number;
};

const IMPORT_SECTORS = new Set([
  'BOBINA AT/BT',
  'CORTE LASER',
  'CORTE DO NUCLEO',
  'FERRAGEM',
  'ISOLANTE',
  'MONTAGEM NUCLEO',
  'MONTAGEM FINAL',
  'MPA',
  'PINTURA',
  'SOLDA',
  'EPOXI',
]);
const IMPORT_LINES = new Set<ImportLine>(['MON', 'TRI', 'EPO']);
const IMPORT_FALLBACK_SECTORS = new Set(['CORTE DO NUCLEO', 'FERRAGEM']);
const SHARED_IMPORT_SECTORS = new Set(['CORTE DO NUCLEO', 'FERRAGEM']);
const TURN_OCCURRENCE_SECTORS = new Set([
  'BOBINA AT/BT',
  'PINTURA',
  'SOLDA',
  'MONTAGEM NUCLEO',
  'CORTE DO NUCLEO',
  'CORTE LASER',
  'FERRAGEM',
]);

function occurrenceAccessSector(setor: string): string {
  if (setor === 'FERRAGEM') return 'CORTE LASER';
  if (setor === 'CORTE DO NUCLEO') return 'MONTAGEM NUCLEO';
  return setor;
}

function isSharedOccurrenceSector(setor: string): boolean {
  return setor === 'FERRAGEM' || setor === 'CORTE DO NUCLEO';
}

type ImportSectorFilter = 'ALL' | string;

function validateImportSectorFilter(value: unknown): ImportSectorFilter {
  const raw = String(value ?? 'ALL').trim().toUpperCase() || 'ALL';
  if (raw === 'ALL') return 'ALL';
  if (!IMPORT_SECTORS.has(raw)) throw new Error(`Setor selecionado para importação é inválido: ${raw}.`);
  return raw;
}

function normalizeProgramacaoImportSector(value: unknown): string | null {
  const sector = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  const aliases: Record<string, string> = {
    'BOBINA AT': 'BOBINA AT/BT',
    'BOBINA BT': 'BOBINA AT/BT',
    'BOBINA AT/BT': 'BOBINA AT/BT',
    'CORTE DO LASER': 'CORTE LASER',
    'CORTE LASER': 'CORTE LASER',
    'CORTE DO NUCLEO': 'CORTE DO NUCLEO',
    'CORTE NUCLEO': 'CORTE DO NUCLEO',
    'FERRAGEM': 'FERRAGEM',
    'FERRAGEM PA': 'FERRAGEM',
    'FERRAGEM PA / ACESSORIOS': 'FERRAGEM',
    'FERRAGEM PA/ACESSORIOS': 'FERRAGEM',
    'ISOLANTE': 'ISOLANTE',
    'MONTAGEM DO NUCLEO': 'MONTAGEM NUCLEO',
    'MONTAGEM NUCLEO': 'MONTAGEM NUCLEO',
    'MONTAGEM FINAL': 'MONTAGEM FINAL',
    'MPA': 'MPA',
    'PINTURA': 'PINTURA',
    'SOLDA': 'SOLDA',
    'EPOXI': 'EPOXI',
  };
  return aliases[sector] || null;
}

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
    const turno = dashboardTurno(item?.turno);

    if (!IMPORT_SECTORS.has(setor)) throw new Error(`Setor de importação inválido: ${setor || 'não informado'}.`);
    if (!IMPORT_LINES.has(linha)) throw new Error(`Linha de importação inválida: ${linha || 'não informada'}.`);
    if (!Number.isFinite(potencia) || potencia <= 0) throw new Error('A potência importada precisa ser maior que zero.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error('A quantidade importada precisa ser um inteiro maior que zero.');
    if (turno && !['1º', '2º'].includes(turno)) throw new Error(`Turno de importação inválido: ${String(item?.turno || '').trim()}.`);
    if (setor === 'EPOXI' && linha !== 'EPO') throw new Error('Epóxi aceita somente registros da linha EPO.');
    if (setor === 'BOBINA AT/BT' && !['AT', 'BT'].includes(tipoBobina)) {
      throw new Error('A produção de Bobinagem precisa identificar AT ou BT.');
    }

    return {
      setor,
      linha,
      potencia,
      quantidade,
      tipoBobina: setor === 'BOBINA AT/BT' ? tipoBobina as 'AT' | 'BT' : undefined,
      turno: turno ? turno as '1º' | '2º' : undefined,
    };
  });
}

async function prepareImportGroups(client: any, groups: ImportGroup[], fallbackUserId?: number): Promise<PreparedImportGroup[]> {
  const sectorNames = [...new Set(groups.map((group) => group.setor))];
  const lineNames = [...new Set(groups.map((group) => group.linha))];

  const sectorsResult = await client.query('SELECT id, nome FROM setores WHERE nome = ANY($1::text[])', [sectorNames]);
  const sectorMap = new Map<string, number>(sectorsResult.rows.map((row: any) => [String(row.nome), Number(row.id)]));

  // Corte do Núcleo e Ferragem podem existir sem usuario_acessos dedicado. Se ainda
  // não existirem em uma base antiga, o próprio fluxo de importação cadastra o setor.
  // Ferragem agora é apontada pelo login compartilhado Corte do Laser/Ferragem.
  for (const sector of sectorNames) {
    if (sectorMap.has(sector)) continue;
    if (!IMPORT_FALLBACK_SECTORS.has(sector)) throw new Error(`Setor ${sector} não encontrado no Neon.`);
    // Evita reutilizar o mesmo placeholder em contextos SQL diferentes. Em alguns
    // esquemas antigos do Neon, isso faz o PostgreSQL inferir tipos incompatíveis
    // para $1 (ex.: varchar/text) e abortar a importação com HTTP 500.
    const existingSector = await client.query(
      'SELECT id, nome FROM setores WHERE nome::text = $1::text LIMIT 1',
      [sector],
    );
    const inserted = existingSector.rows.length
      ? existingSector
      : await client.query(
          'INSERT INTO setores(nome) VALUES($1::text) RETURNING id, nome',
          [sector],
        );
    const row = inserted.rows[0];
    if (!row) throw new Error(`Não foi possível preparar o setor ${sector} para a importação.`);
    sectorMap.set(String(row.nome), Number(row.id));
  }

  const [linesResult, accessResult] = await Promise.all([
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

  const lineMap = new Map<string, number>(linesResult.rows.map((row: any) => [String(row.nome), Number(row.id)]));
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
    const sectorCandidates = [...accessByUserSector.values()].filter((access) => access.setor === setor);
    const exactCandidates = sectorCandidates.filter((access) => neededLines.every((line) => access.lines.has(line)));
    // EPO pode aparecer em qualquer setor. Bancos já existentes podem ainda não ter EPO
    // cadastrado no acesso do apontador daquele setor; nesse caso, preservamos a linha EPO
    // e usamos o apontador compatível com as demais linhas da mesma unidade operacional.
    const fallbackLines = neededLines.filter((line) => line !== 'EPO');
    const fallbackCandidates = sectorCandidates.filter((access) => fallbackLines.every((line) => access.lines.has(line)));
    const candidates = (exactCandidates.length ? exactCandidates : fallbackCandidates)
      .sort((a, b) => {
        const exactA = a.lines.size === neededLines.length ? 0 : 1;
        const exactB = b.lines.size === neededLines.length ? 0 : 1;
        return exactA - exactB || a.lines.size - b.lines.size || a.usuarioId - b.usuarioId;
      });

    const selected = candidates[0];
    if (!selected) {
      if (IMPORT_FALLBACK_SECTORS.has(setor) && fallbackUserId) {
        const setorId = sectorMap.get(setor);
        if (!setorId) throw new Error(`Setor ${setor} não encontrado no Neon.`);
        const lineIds = new Map<string, number>();
        for (const line of neededLines) {
          const lineId = lineMap.get(line);
          if (lineId) lineIds.set(line, lineId);
        }
        assignments.set(unitKey, { usuarioId: fallbackUserId, setorId, lineIds });
        continue;
      }
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
            a.origem_producao, a.complementado, a.turno1_complementado, a.turno2_complementado, aprovador.login aprovado_por_nome
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
      `SELECT p.id, l.nome linha, p.potencia, p.quantidade, p.turno
         FROM producao p
         JOIN linhas l ON l.id = p.linha_id
        WHERE p.apontamento_id = $1
        ORDER BY p.id`,
      [id],
    ),
    pool.query(
      `SELECT id, causa_motivo, material, hora_inicio, hora_fim, turno
         FROM paradas_falta_material
        WHERE apontamento_id = $1
        ORDER BY id`,
      [id],
    ),
    pool.query(
      `SELECT id, maquina_equipamento, hora_inicio, hora_fim, observacao, turno
         FROM paradas_maquina
        WHERE apontamento_id = $1
        ORDER BY id`,
      [id],
    ),
    pool.query(
      `SELECT id, causa_nao_conformidade, op, numero_serie, turno
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
    userName: displayLoginName(x.usuario),
    linhasPermitidas: acessos.rows.map((r: any) => r.linha).filter(Boolean),
    producoes: p.rows.map((r: any) => ({
      id: String(r.id), linha: r.linha, potencia: Number(r.potencia),
      potenciaFormatted: String(r.potencia).replace('.', ','), quantidade: r.quantidade,
      turno: dashboardTurno(r.turno) || undefined,
    })),
    paradasFaltaMaterial: material.rows.map((r: any) => ({
      id: String(r.id), causaMotivo: r.causa_motivo || '', material: r.material || '',
      horaInicio: shortTime(r.hora_inicio), horaFim: shortTime(r.hora_fim), turno: r.turno ? String(r.turno).toLowerCase() : undefined,
    })),
    paradasMaquina: maquina.rows.map((r: any) => ({
      id: String(r.id), maquinaEquipamento: r.maquina_equipamento || '',
      horaInicio: shortTime(r.hora_inicio), horaFim: shortTime(r.hora_fim), observacao: r.observacao || '', turno: r.turno ? String(r.turno).toLowerCase() : undefined,
    })),
    naoConformidades: nc.rows.map((r: any) => ({
      id: String(r.id), causaNaoConformidade: r.causa_nao_conformidade || '', op: r.op || '', numeroSerie: r.numero_serie || '', turno: r.turno ? String(r.turno).toLowerCase() : undefined,
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
    turno1Complementado: x.turno1_complementado === true,
    turno2Complementado: x.turno2_complementado === true,
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

async function deleteOccurrenceCollections(client: any, apontamentoId: number, data: any, turno?: string | null) {
  // Substitui apenas coleções explicitamente enviadas. No fluxo por turno a exclusão
  // é limitada ao turno selecionado para nunca apagar o que o outro turno registrou.
  const has = (key: string) => Object.prototype.hasOwnProperty.call(data || {}, key);
  const deleteCollection = async (table: string) => {
    if (turno) await client.query(`DELETE FROM ${table} WHERE apontamento_id = $1 AND UPPER(COALESCE(turno, '')) = UPPER($2)`, [apontamentoId, turno]);
    else await client.query(`DELETE FROM ${table} WHERE apontamento_id = $1`, [apontamentoId]);
  };
  if (has('paradasFaltaMaterial')) await deleteCollection('paradas_falta_material');
  if (has('paradasMaquina')) await deleteCollection('paradas_maquina');
  if (has('naoConformidades')) await deleteCollection('nao_conformidades');
  if (has('faltas')) await deleteCollection('faltas');
  if (has('observacoes')) await deleteCollection('observacoes');
}

async function insertOccurrenceCollections(client: any, apontamentoId: number, data: any, lineMap: Map<any, any>) {
  for (const item of occurrenceList(data.paradasFaltaMaterial)) {
    await client.query(
      `INSERT INTO paradas_falta_material(apontamento_id, causa_motivo, material, hora_inicio, hora_fim, turno)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [apontamentoId, String(item.causaMotivo || '').trim(), String(item.material || '').trim(), item.horaInicio || null, item.horaFim || null, item.turno ? String(item.turno).toUpperCase() : null],
    );
  }
  for (const item of occurrenceList(data.paradasMaquina)) {
    await client.query(
      `INSERT INTO paradas_maquina(apontamento_id, maquina_equipamento, hora_inicio, hora_fim, observacao, turno)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [apontamentoId, String(item.maquinaEquipamento || '').trim(), item.horaInicio || null, item.horaFim || null, String(item.observacao || '').trim(), item.turno ? String(item.turno).toUpperCase() : null],
    );
  }
  for (const item of occurrenceList(data.naoConformidades)) {
    await client.query(
      `INSERT INTO nao_conformidades(apontamento_id, causa_nao_conformidade, op, numero_serie, turno)
       VALUES($1, $2, $3, $4, $5)`,
      [apontamentoId, String(item.causaNaoConformidade || '').trim(), String(item.op || '').trim(), String(item.numeroSerie || '').trim(), item.turno ? String(item.turno).toUpperCase() : null],
    );
  }
  for (const item of occurrenceList(data.faltas)) {
    await client.query(
      `INSERT INTO faltas(apontamento_id, linha_id, turno, quantidade, justificativa, nome, motivo_justificativa, atestado)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        apontamentoId,
        item.linha ? lineMap.get(item.linha) || null : null,
        item.turno ? String(item.turno).toUpperCase() : null,
        item.quantidade ?? null,
        String(item.justificativa || '').trim() || null,
        String(item.nome || '').trim() || null,
        String(item.motivoJustificativa || '').trim() || null,
        typeof item.atestado === 'boolean' ? item.atestado : null,
      ],
    );
  }
  for (const item of occurrenceList(data.observacoes)) {
    await client.query(
      `INSERT INTO observacoes(apontamento_id, linha_id, turno, observacao, justificativa_meta)
       VALUES($1, $2, $3, $4, $5)`,
      [
        apontamentoId,
        item.linha ? lineMap.get(item.linha) || null : null,
        item.turno ? String(item.turno).toUpperCase() : null,
        String(item.observacao || '').trim(),
        String(item.justificativaMeta || '').trim() || null,
      ],
    );
  }

}

async function mergeApontamentoIntoCanonical(
  client: any,
  canonicalId: number,
  duplicateId: number,
): Promise<number> {
  if (canonicalId === duplicateId) return canonicalId;

  const meta = await client.query(
    `SELECT id, complementado, turno1_complementado, turno2_complementado
       FROM apontamentos
      WHERE id = ANY($1::bigint[])
      FOR UPDATE`,
    [[canonicalId, duplicateId]],
  );
  const canonical = meta.rows.find((row: any) => Number(row.id) === canonicalId);
  const duplicate = meta.rows.find((row: any) => Number(row.id) === duplicateId);
  if (!canonical) return duplicate ? duplicateId : canonicalId;
  if (!duplicate) return canonicalId;

  // Ocorrências pertencem ao cartão operacional (data + setor), não ao cartão
  // físico que existia antes da consolidação. Ao corrigir uma data, todo o
  // conteúdo digitado no dia incorreto é incorporado ao cartão correto.
  for (const table of ['paradas_falta_material', 'paradas_maquina', 'nao_conformidades', 'faltas', 'observacoes']) {
    await client.query(`UPDATE ${table} SET apontamento_id = $1 WHERE apontamento_id = $2`, [canonicalId, duplicateId]);
  }

  // Preserva produção que exista somente no cartão movido, mas nunca duplica o
  // mesmo grupo linha + potência + turno já presente no cartão de destino.
  await client.query(
    `INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade, turno)
     SELECT $1, p.linha_id, p.potencia, p.quantidade, p.turno
       FROM producao p
      WHERE p.apontamento_id = $2
        AND NOT EXISTS (
          SELECT 1
            FROM producao atual
           WHERE atual.apontamento_id = $1
             AND atual.linha_id = p.linha_id
             AND atual.potencia = p.potencia
             AND COALESCE(atual.turno::text, '') = COALESCE(p.turno::text, '')
        )`,
    [canonicalId, duplicateId],
  );
  await client.query('DELETE FROM producao WHERE apontamento_id = $1', [duplicateId]);
  await client.query('DELETE FROM apontamentos WHERE id = $1', [duplicateId]);

  const turno1 = canonical.turno1_complementado === true || duplicate.turno1_complementado === true;
  const turno2 = canonical.turno2_complementado === true || duplicate.turno2_complementado === true;
  const hasTurnFlags = turno1 || turno2;
  const legacyComplemented = canonical.complementado === true || duplicate.complementado === true;
  const complementado = hasTurnFlags ? (turno1 && turno2) : legacyComplemented;

  await client.query(
    `UPDATE apontamentos
        SET turno1_complementado = $2,
            turno2_complementado = $3,
            complementado = $4,
            status_aprovacao = 'PENDENTE',
            aprovado_em = NULL,
            aprovado_por = NULL,
            atualizado_em = NOW()
      WHERE id = $1`,
    [canonicalId, turno1, turno2, complementado],
  );

  return canonicalId;
}

async function mergeTurnSectorDuplicateGroup(
  client: any,
  data: string,
  setorId: number,
  tipoBobina: string | null = null,
  preferredUserId?: number,
): Promise<number | null> {
  const records = await client.query(
    `SELECT a.id,
            a.usuario_id,
            a.origem_producao,
            a.complementado,
            a.turno1_complementado,
            a.turno2_complementado,
            a.atualizado_em,
            EXISTS(SELECT 1 FROM producao p WHERE p.apontamento_id = a.id) AS possui_producao
       FROM apontamentos a
      WHERE a.data = $1::date
        AND a.setor_id = $2
        AND (($3::text IS NULL AND a.tipo_bobina IS NULL) OR a.tipo_bobina::text = $3::text)
      ORDER BY
        possui_producao DESC,
        CASE WHEN a.origem_producao = 'IMPORTADO' THEN 0 ELSE 1 END,
        CASE WHEN $4::bigint IS NOT NULL AND a.usuario_id = $4::bigint THEN 0 ELSE 1 END,
        a.atualizado_em DESC,
        a.id DESC
      FOR UPDATE`,
    [data, setorId, tipoBobina, preferredUserId || null],
  );

  if (!records.rows.length) return null;
  const canonicalId = Number(records.rows[0].id);
  for (const row of records.rows.slice(1)) {
    await mergeApontamentoIntoCanonical(client, canonicalId, Number(row.id));
  }
  return canonicalId;
}

async function repairAllTurnSectorDuplicates() {
  const client = await pool.connect();
  try {
    const groups = await client.query(
      `SELECT a.data, a.setor_id, a.tipo_bobina
         FROM apontamentos a
         JOIN setores s ON s.id = a.setor_id
        WHERE UPPER(s.nome) = ANY($1::text[])
        GROUP BY a.data, a.setor_id, a.tipo_bobina
       HAVING COUNT(*) > 1`,
      [[...TURN_OCCURRENCE_SECTORS]],
    );
    if (!groups.rows.length) return;

    await client.query('BEGIN');
    for (const group of groups.rows) {
      await mergeTurnSectorDuplicateGroup(
        client,
        dateOnly(group.data),
        Number(group.setor_id),
        group.tipo_bobina ? String(group.tipo_bobina) : null,
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Falha ao consolidar cartões duplicados por turno:', error);
  } finally {
    client.release();
  }
}

type LoadApontamentosBatchOptions = {
  userId?: number;
  pendingImportedOnly?: boolean;
  excludePendingImported?: boolean;
};

async function loadApontamentosBatch(options: LoadApontamentosBatchOptions = {}): Promise<any[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (Number.isFinite(options.userId)) {
    params.push(Number(options.userId));
    conditions.push(`a.usuario_id = $${params.length}`);
  }
  if (options.pendingImportedOnly) {
    conditions.push(`a.origem_producao = 'IMPORTADO' AND a.complementado = FALSE`);
  }
  if (options.excludePendingImported) {
    conditions.push(`NOT (a.origem_producao = 'IMPORTADO' AND a.complementado = FALSE)`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const headers = await pool.query(
    `SELECT a.id, a.data, a.usuario_id, a.setor_id, a.tipo_bobina, u.login usuario, s.nome setor,
            a.criado_em, a.atualizado_em, a.status_aprovacao, a.aprovado_em, a.aprovado_por,
            a.origem_producao, a.complementado, a.turno1_complementado, a.turno2_complementado, aprovador.login aprovado_por_nome
       FROM apontamentos a
       JOIN usuarios u ON u.id = a.usuario_id
       JOIN setores s ON s.id = a.setor_id
       LEFT JOIN usuarios aprovador ON aprovador.id = a.aprovado_por
       ${where}
      ORDER BY a.data DESC, a.id DESC`,
    params,
  );

  if (!headers.rows.length) return [];
  const ids = headers.rows.map((row: any) => Number(row.id));

  const [p, material, maquina, nc, f, o, acessos] = await Promise.all([
    pool.query(
      `SELECT p.apontamento_id, p.id, l.nome linha, p.potencia, p.quantidade, p.turno
         FROM producao p
         JOIN linhas l ON l.id = p.linha_id
        WHERE p.apontamento_id = ANY($1::bigint[])
        ORDER BY p.apontamento_id, p.id`, [ids],
    ),
    pool.query(
      `SELECT apontamento_id, id, causa_motivo, material, hora_inicio, hora_fim, turno
         FROM paradas_falta_material
        WHERE apontamento_id = ANY($1::bigint[])
        ORDER BY apontamento_id, id`, [ids],
    ),
    pool.query(
      `SELECT apontamento_id, id, maquina_equipamento, hora_inicio, hora_fim, observacao, turno
         FROM paradas_maquina
        WHERE apontamento_id = ANY($1::bigint[])
        ORDER BY apontamento_id, id`, [ids],
    ),
    pool.query(
      `SELECT apontamento_id, id, causa_nao_conformidade, op, numero_serie, turno
         FROM nao_conformidades
        WHERE apontamento_id = ANY($1::bigint[])
        ORDER BY apontamento_id, id`, [ids],
    ),
    pool.query(
      `SELECT f.apontamento_id, f.id, l.nome linha, f.turno, f.quantidade, f.justificativa,
              f.nome, f.motivo_justificativa, f.atestado
         FROM faltas f
         LEFT JOIN linhas l ON l.id = f.linha_id
        WHERE f.apontamento_id = ANY($1::bigint[])
        ORDER BY f.apontamento_id, f.id`, [ids],
    ),
    pool.query(
      `SELECT o.apontamento_id, o.id, l.nome linha, o.turno, o.observacao, o.justificativa_meta
         FROM observacoes o
         LEFT JOIN linhas l ON l.id = o.linha_id
        WHERE o.apontamento_id = ANY($1::bigint[])
        ORDER BY o.apontamento_id, o.id`, [ids],
    ),
    pool.query(
      `SELECT DISTINCT h.id apontamento_id, l.nome linha
         FROM apontamentos h
         JOIN usuario_acessos ua ON ua.usuario_id = h.usuario_id AND ua.setor_id = h.setor_id
         JOIN linhas l ON l.id = ua.linha_id
        WHERE h.id = ANY($1::bigint[])
        ORDER BY h.id, l.nome`, [ids],
    ),
  ]);

  const group = (rows: any[]) => {
    const map = new Map<number, any[]>();
    for (const row of rows) {
      const id = Number(row.apontamento_id);
      const list = map.get(id) || [];
      list.push(row);
      map.set(id, list);
    }
    return map;
  };

  const producoesById = group(p.rows);
  const materialById = group(material.rows);
  const maquinaById = group(maquina.rows);
  const ncById = group(nc.rows);
  const faltasById = group(f.rows);
  const observacoesById = group(o.rows);
  const acessosById = group(acessos.rows);
  const shortTime = (value: any) => String(value || '').slice(0, 5);

  return headers.rows.map((x: any) => {
    const id = Number(x.id);
    const tipoBobina = ['AT', 'BT'].includes(String(x.tipo_bobina || '').toUpperCase())
      ? String(x.tipo_bobina).toUpperCase()
      : null;
    const setorExibicao = x.setor === 'BOBINA AT/BT' && tipoBobina ? `BOBINA ${tipoBobina}` : x.setor;

    return {
      id: String(x.id),
      data: dateOnly(x.data),
      setor: setorExibicao,
      tipoBobina: tipoBobina || undefined,
      userId: String(x.usuario_id),
      userName: displayLoginName(x.usuario),
      linhasPermitidas: (acessosById.get(id) || []).map((r: any) => r.linha).filter(Boolean),
      producoes: (producoesById.get(id) || []).map((r: any) => ({
        id: String(r.id), linha: r.linha, potencia: Number(r.potencia),
        potenciaFormatted: String(r.potencia).replace('.', ','), quantidade: r.quantidade,
        turno: dashboardTurno(r.turno) || undefined,
      })),
      paradasFaltaMaterial: (materialById.get(id) || []).map((r: any) => ({
        id: String(r.id), causaMotivo: r.causa_motivo || '', material: r.material || '',
        horaInicio: shortTime(r.hora_inicio), horaFim: shortTime(r.hora_fim), turno: r.turno ? String(r.turno).toLowerCase() : undefined,
      })),
      paradasMaquina: (maquinaById.get(id) || []).map((r: any) => ({
        id: String(r.id), maquinaEquipamento: r.maquina_equipamento || '',
        horaInicio: shortTime(r.hora_inicio), horaFim: shortTime(r.hora_fim), observacao: r.observacao || '', turno: r.turno ? String(r.turno).toLowerCase() : undefined,
      })),
      naoConformidades: (ncById.get(id) || []).map((r: any) => ({
        id: String(r.id), causaNaoConformidade: r.causa_nao_conformidade || '', op: r.op || '', numeroSerie: r.numero_serie || '', turno: r.turno ? String(r.turno).toLowerCase() : undefined,
      })),
      faltas: (faltasById.get(id) || []).map((r: any) => ({
        id: String(r.id), nome: r.nome || undefined, motivoJustificativa: r.motivo_justificativa || undefined,
        atestado: typeof r.atestado === 'boolean' ? r.atestado : undefined, linha: r.linha || undefined,
        turno: r.turno ? String(r.turno).toLowerCase() : undefined, quantidade: r.quantidade ?? undefined,
        justificativa: r.justificativa || undefined,
      })),
      observacoes: (observacoesById.get(id) || []).map((r: any) => ({
        id: String(r.id), linha: r.linha || undefined, turno: r.turno ? String(r.turno).toLowerCase() : undefined,
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
      turno1Complementado: x.turno1_complementado === true,
      turno2Complementado: x.turno2_complementado === true,
    };
  });
}

app.get('/api/apontamentos', auth, async (req: any, res) => {
  try {
    const registros = await loadApontamentosBatch({
      userId: Number(req.auth.userId),
      excludePendingImported: true,
    });
    res.json(registros);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar histórico.' });
  }
});

app.get('/api/apontamentos/importados/pendentes', auth, async (req: any, res) => {
  if (req.auth?.perfil === 'COORDENACAO') return res.json([]);
  try {
    const registros = await loadApontamentosBatch({
      userId: Number(req.auth.userId),
      pendingImportedOnly: true,
    });
    res.json(registros);
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
    const setor = String(req.query?.setor || '').trim().toUpperCase();
    const rawTipoBobina = String(req.query?.tipoBobina || '').trim().toUpperCase();
    const tipoBobina = ['AT', 'BT'].includes(rawTipoBobina) ? rawTipoBobina : null;

    if (setor && !IMPORT_SECTORS.has(setor)) {
      return res.status(400).json({ error: 'Setor inválido para consulta de ocorrências.' });
    }
    if (setor === 'BOBINA AT/BT' && !tipoBobina) {
      return res.status(400).json({ error: 'Selecione Bobina AT ou Bobina BT.' });
    }

    // Nos setores com controle de turno o cartão pertence à unidade operacional
    // (data + setor), não ao usuário que registrou primeiro. Assim 1º e 2º turno
    // sempre enxergam e complementam o mesmo apontamento.
    if (setor && TURN_OCCURRENCE_SECTORS.has(setor)) {
      const accessSector = occurrenceAccessSector(setor);
      const access = await getUserAccess(req.auth.userId);
      const hasLinkedAccess = access.some(
        (row: any) => String(row.setor || '').trim().toUpperCase() === accessSector,
      );
      if (!hasLinkedAccess) {
        const groupedLogin = setor === 'FERRAGEM'
          ? 'Corte do Laser/Ferragem'
          : setor === 'CORTE DO NUCLEO'
            ? 'Montagem do Núcleo/Corte do Núcleo'
            : null;
        return res.status(403).json({
          error: groupedLogin
            ? `O acesso a ${setor} é permitido pelo login ${groupedLogin}.`
            : `O usuário não possui acesso ao setor ${setor}.`,
        });
      }

      const sectorResult = await pool.query(
        'SELECT id FROM setores WHERE UPPER(nome) = $1 ORDER BY id LIMIT 1',
        [setor],
      );
      if (!sectorResult.rows.length) return res.json(null);
      const setorId = Number(sectorResult.rows[0].id);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const canonicalId = await mergeTurnSectorDuplicateGroup(
          client,
          req.params.data,
          setorId,
          null,
          Number(req.auth.userId),
        );
        await client.query('COMMIT');
        return res.json(canonicalId ? await loadApontamento(canonicalId) : null);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    const r = setor
      ? await pool.query(
          `SELECT a.id
             FROM apontamentos a
             JOIN setores s ON s.id = a.setor_id
            WHERE a.usuario_id = $1
              AND a.data = $2
              AND UPPER(s.nome) = $3
              AND (($4::text IS NULL AND a.tipo_bobina IS NULL) OR a.tipo_bobina::text = $4::text)
            ORDER BY a.id DESC
            LIMIT 1`,
          [req.auth.userId, req.params.data, setor, tipoBobina],
        )
      : await pool.query(
          'SELECT id FROM apontamentos WHERE usuario_id = $1 AND data = $2 ORDER BY id DESC LIMIT 1',
          [req.auth.userId, req.params.data],
        );
    res.json(r.rows.length ? await loadApontamento(r.rows[0].id) : null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar apontamento.' });
  }
});

// Todos os setores podem registrar ocorrências antes da importação da produção.
// A seleção de 1º/2º turno continua exclusiva dos setores definidos em
// TURN_OCCURRENCE_SECTORS. Corte do Laser/Ferragem e Montagem do Núcleo/Corte do
// Núcleo compartilham login, mas os registros permanecem separados pelo setor real.
// Quando a Coordenação importar a produção, replaceImportedProductionForDate encontra
// o mesmo apontamento e substitui somente a coleção de produção.
app.post('/api/apontamentos/ocorrencias', auth, async (req: any, res) => {
  if (req.auth?.perfil === 'COORDENACAO') {
    return res.status(403).json({ error: 'A COORDENAÇÃO não utiliza o registro de ocorrências do apontador.' });
  }

  const data = req.body || {};
  const dataApontamento = String(data.data || '').trim();
  const setor = String(data.setor || '').trim().toUpperCase();
  const turno = String(data.turno || '').trim().toLowerCase();
  const rawTipoBobina = String(data.tipoBobina || '').trim().toUpperCase();
  const tipoBobina = ['AT', 'BT'].includes(rawTipoBobina) ? rawTipoBobina : null;
  const usesTurnFlow = TURN_OCCURRENCE_SECTORS.has(setor);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataApontamento)) {
    return res.status(400).json({ error: 'Informe uma data válida para registrar as ocorrências.' });
  }
  if (!IMPORT_SECTORS.has(setor)) {
    return res.status(403).json({ error: 'Este setor não está habilitado para registro de ocorrências.' });
  }
  if (usesTurnFlow && !['1º turno', '2º turno'].includes(turno)) {
    return res.status(400).json({ error: 'Selecione o 1º ou o 2º turno antes de registrar as ocorrências.' });
  }
  if (setor === 'BOBINA AT/BT' && !tipoBobina) {
    return res.status(400).json({ error: 'Selecione Bobina AT ou Bobina BT antes de registrar as ocorrências.' });
  }
  const validation = validateOccurrencePayload(data);
  if (validation) return res.status(400).json({ error: validation });

  const client = await pool.connect();
  try {
    const access = await getUserAccess(req.auth.userId);
    const sharedSector = isSharedOccurrenceSector(setor);
    const accessSector = occurrenceAccessSector(setor);
    const sectorAccess = access.filter(
      (row: any) => String(row.setor || '').trim().toUpperCase() === accessSector,
    );
    if (!sectorAccess.length) {
      const groupedLogin = setor === 'FERRAGEM'
        ? 'Corte do Laser/Ferragem'
        : setor === 'CORTE DO NUCLEO'
          ? 'Montagem do Núcleo/Corte do Núcleo'
          : null;
      return res.status(403).json({
        error: groupedLogin
          ? `O acesso a ${setor} é permitido pelo login ${groupedLogin}.`
          : `O usuário não possui acesso ao setor ${setor}.`,
      });
    }

    let setorId: number;
    if (sharedSector) {
      let sectorResult = await client.query(
        'SELECT id FROM setores WHERE UPPER(nome) = $1 ORDER BY id LIMIT 1',
        [setor],
      );
      // Compatibilidade com bases antigas: não exige SQL manual para cadastrar o
      // setor vinculado caso ele ainda não exista na tabela de setores.
      if (!sectorResult.rows.length) {
        sectorResult = await client.query('INSERT INTO setores(nome) VALUES($1) RETURNING id', [setor]);
      }
      setorId = Number(sectorResult.rows[0].id);
    } else {
      setorId = Number(sectorAccess[0].setor_id);
    }

    // As linhas MON/TRI/EPO são globais no modelo. Nos setores agrupados reutilizamos
    // as linhas permitidas pelo login principal, sem criar novos usuario_acessos.
    const allowed = new Map(sectorAccess.map((row: any) => [row.linha, row.linha_id]));
    const lineBearingItems = [...occurrenceList(data.faltas), ...occurrenceList(data.observacoes)];
    for (const item of lineBearingItems) {
      if (item.linha && !allowed.has(item.linha)) {
        return res.status(403).json({ error: `Linha ${item.linha} não permitida para este usuário/setor.` });
      }
    }

    const scopedData = usesTurnFlow ? {
      ...data,
      paradasFaltaMaterial: occurrenceList(data.paradasFaltaMaterial).map((item) => ({ ...item, turno })),
      paradasMaquina: occurrenceList(data.paradasMaquina).map((item) => ({ ...item, turno })),
      naoConformidades: occurrenceList(data.naoConformidades).map((item) => ({ ...item, turno })),
      faltas: occurrenceList(data.faltas).map((item) => ({ ...item, turno })),
      observacoes: occurrenceList(data.observacoes).map((item) => ({ ...item, turno })),
    } : data;
    const turnoDb = usesTurnFlow ? turno.toUpperCase() : null;
    const dbTipoBobina = setor === 'BOBINA AT/BT' ? tipoBobina : null;

    await client.query('BEGIN');
    let currentId: number | null = null;
    if (usesTurnFlow) {
      // A chave operacional dos setores com turno é data + setor. Se versões
      // anteriores criaram um cartão para cada turno/usuário, consolida tudo antes
      // de salvar para que as ocorrências coexistam no mesmo registro.
      currentId = await mergeTurnSectorDuplicateGroup(
        client,
        dataApontamento,
        setorId,
        dbTipoBobina,
        Number(req.auth.userId),
      );
    } else {
      const current = sharedSector
        ? await client.query(
            `SELECT id
               FROM apontamentos
              WHERE setor_id = $1
                AND data = $2::date
                AND tipo_bobina IS NULL
              ORDER BY CASE WHEN usuario_id = $3 THEN 0 ELSE 1 END,
                       CASE WHEN origem_producao = 'IMPORTADO' THEN 0 ELSE 1 END,
                       id DESC
              LIMIT 1
              FOR UPDATE`,
            [setorId, dataApontamento, req.auth.userId],
          )
        : await client.query(
            `SELECT id
               FROM apontamentos
              WHERE usuario_id = $1
                AND setor_id = $2
                AND data = $3::date
                AND (($4::text IS NULL AND tipo_bobina IS NULL) OR tipo_bobina::text = $4::text)
              ORDER BY CASE WHEN origem_producao = 'IMPORTADO' THEN 0 ELSE 1 END, id DESC
              LIMIT 1
              FOR UPDATE`,
            [req.auth.userId, setorId, dataApontamento, dbTipoBobina],
          );
      currentId = current.rows.length ? Number(current.rows[0].id) : null;
    }

    let apontamentoId: number;
    if (currentId) {
      apontamentoId = currentId;
      if (sharedSector) {
        // Se a produção foi importada antes das ocorrências, o registro pode ter
        // nascido vinculado à Coordenação. Ao apontar, preservamos como responsável
        // o usuário que efetivamente registrou as ocorrências.
        await client.query('UPDATE apontamentos SET usuario_id = $2 WHERE id = $1', [apontamentoId, req.auth.userId]);
      }
    } else {
      const inserted = await client.query(
        `INSERT INTO apontamentos(data, usuario_id, setor_id, tipo_bobina, origem_producao, complementado)
         VALUES($1::date, $2, $3, $4, 'IMPORTADO', FALSE)
         RETURNING id`,
        [dataApontamento, req.auth.userId, setorId, dbTipoBobina],
      );
      apontamentoId = Number(inserted.rows[0].id);
    }

    if (usesTurnFlow) {
      const firstTurn = turno === '1º turno';
      await client.query(
        `UPDATE apontamentos
            SET origem_producao = 'IMPORTADO',
                turno1_complementado = CASE WHEN $2::boolean THEN TRUE ELSE COALESCE(turno1_complementado, FALSE) END,
                turno2_complementado = CASE WHEN $2::boolean THEN COALESCE(turno2_complementado, FALSE) ELSE TRUE END,
                complementado = CASE WHEN $2::boolean THEN COALESCE(turno2_complementado, FALSE) ELSE COALESCE(turno1_complementado, FALSE) END,
                atualizado_em = NOW(),
                status_aprovacao = 'PENDENTE',
                aprovado_em = NULL,
                aprovado_por = NULL
          WHERE id = $1`,
        [apontamentoId, firstTurn],
      );
    } else {
      await client.query(
        `UPDATE apontamentos
            SET origem_producao = 'IMPORTADO',
                complementado = TRUE,
                atualizado_em = NOW(),
                status_aprovacao = 'PENDENTE',
                aprovado_em = NULL,
                aprovado_por = NULL
          WHERE id = $1`,
        [apontamentoId],
      );
    }

    await deleteOccurrenceCollections(client, apontamentoId, scopedData, turnoDb);
    await insertOccurrenceCollections(client, apontamentoId, scopedData, allowed);
    await client.query('COMMIT');
    res.json(await loadApontamento(apontamentoId));
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    if (e?.code === '42P01' || e?.code === '42703') {
      return res.status(500).json({ error: 'A estrutura de turnos do Neon não está atualizada. Execute a migração de turnos já utilizada pelo sistema.' });
    }
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'Já existe um apontamento para esta data. Atualize a página e tente novamente.' });
    }
    res.status(500).json({ error: 'Falha ao registrar as ocorrências.' });
  } finally {
    client.release();
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
      `SELECT a.id, a.usuario_id, a.setor_id, a.origem_producao, s.nome setor,
              a.turno1_complementado, a.turno2_complementado
         FROM apontamentos a
         JOIN setores s ON s.id = a.setor_id
        WHERE a.id = $1 AND a.usuario_id = $2`,
      [id, req.auth.userId],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Produção importada não encontrada.' });
    if (String(current.rows[0].origem_producao || '').toUpperCase() !== 'IMPORTADO') {
      return res.status(400).json({ error: 'Este registro não foi criado por importação de produção.' });
    }

    const setor = String(current.rows[0].setor || '').trim().toUpperCase();
    const usesTurnFlow = TURN_OCCURRENCE_SECTORS.has(setor);
    const turno = String(data.turno || '').trim().toLowerCase();
    if (usesTurnFlow && !['1º turno', '2º turno'].includes(turno)) {
      return res.status(400).json({ error: 'Selecione o 1º ou o 2º turno antes de finalizar.' });
    }
    const turnoDb = usesTurnFlow ? turno.toUpperCase() : null;
    const scopedData = usesTurnFlow ? {
      ...data,
      paradasFaltaMaterial: occurrenceList(data.paradasFaltaMaterial).map((item) => ({ ...item, turno })),
      paradasMaquina: occurrenceList(data.paradasMaquina).map((item) => ({ ...item, turno })),
      naoConformidades: occurrenceList(data.naoConformidades).map((item) => ({ ...item, turno })),
      faltas: occurrenceList(data.faltas).map((item) => ({ ...item, turno })),
      observacoes: occurrenceList(data.observacoes).map((item) => ({ ...item, turno })),
    } : data;

    const access = await getUserAccess(req.auth.userId);
    const setorId = Number(current.rows[0].setor_id);
    const allowed = new Map(
      access.filter((row: any) => Number(row.setor_id) === setorId).map((row: any) => [row.linha, row.linha_id]),
    );
    const lineBearingItems = [...occurrenceList(scopedData.faltas), ...occurrenceList(scopedData.observacoes)];
    for (const item of lineBearingItems) {
      if (item.linha && !allowed.has(item.linha)) {
        return res.status(403).json({ error: `Linha ${item.linha} não permitida para este usuário/setor.` });
      }
    }

    await client.query('BEGIN');
    if (usesTurnFlow) {
      const firstTurn = turno === '1º turno';
      await client.query(
        `UPDATE apontamentos
            SET turno1_complementado = CASE WHEN $3::boolean THEN TRUE ELSE turno1_complementado END,
                turno2_complementado = CASE WHEN $3::boolean THEN turno2_complementado ELSE TRUE END,
                complementado = CASE WHEN $3::boolean THEN turno2_complementado ELSE turno1_complementado END,
                atualizado_em = NOW(),
                status_aprovacao = 'PENDENTE',
                aprovado_em = NULL,
                aprovado_por = NULL
          WHERE id = $1 AND usuario_id = $2`,
        [id, req.auth.userId, firstTurn],
      );
    } else {
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
    }
    await deleteOccurrenceCollections(client, id, scopedData, turnoDb);
    await insertOccurrenceCollections(client, id, scopedData, allowed);
    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    if (e?.code === '42P01' || e?.code === '42703') {
      return res.status(500).json({ error: 'A estrutura de turnos do Neon não está atualizada. Execute a migração de turnos já utilizada pelo sistema.' });
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
      `SELECT a.id, a.usuario_id, a.setor_id, a.data, a.origem_producao, a.tipo_bobina, s.nome setor
         FROM apontamentos a
         JOIN setores s ON s.id = a.setor_id
        WHERE a.id = $1 AND a.usuario_id = $2`,
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
    const originalDate = dateOnly(current.rows[0].data);
    const nextDate = isImported ? originalDate : dateOnly(data.data);
    const setorNome = String(current.rows[0].setor || '').trim().toUpperCase();
    const tipoBobina = current.rows[0].tipo_bobina ? String(current.rows[0].tipo_bobina) : null;

    // Salva primeiro o conteúdo editado no cartão de origem. A mudança de data é
    // resolvida depois, permitindo incorporar o cartão diretamente ao destino sem
    // criar temporariamente dois cartões iguais no Neon.
    await client.query(
      `UPDATE apontamentos
          SET complementado = CASE WHEN origem_producao = 'IMPORTADO' THEN TRUE ELSE complementado END,
              atualizado_em = NOW(),
              status_aprovacao = 'PENDENTE',
              aprovado_em = NULL,
              aprovado_por = NULL
        WHERE id = $1 AND usuario_id = $2`,
      [id, req.auth.userId],
    );

    if (!isImported) {
      await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
      for (const item of occurrenceList(data.producoes)) {
        await client.query(
          'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade, turno) VALUES($1, $2, $3, $4, $5)',
          [id, allowed.get(item.linha), item.potencia, item.quantidade, dashboardTurno(item.turno) || null],
        );
      }
    }
    await deleteOccurrenceCollections(client, id, data);
    await insertOccurrenceCollections(client, id, data, allowed);

    let finalId = id;
    if (nextDate !== originalDate && TURN_OCCURRENCE_SECTORS.has(setorNome)) {
      // Se já existe cartão no dia correto, incorpora o cartão movido diretamente
      // nele. Produção e ocorrências dos dois turnos são preservadas.
      const targetId = await mergeTurnSectorDuplicateGroup(
        client,
        nextDate,
        Number(current.rows[0].setor_id),
        tipoBobina,
        Number(req.auth.userId),
      );
      if (targetId && targetId !== id) {
        finalId = await mergeApontamentoIntoCanonical(client, targetId, id);
      } else {
        await client.query('UPDATE apontamentos SET data = $1, atualizado_em = NOW() WHERE id = $2', [nextDate, id]);
        finalId = (await mergeTurnSectorDuplicateGroup(
          client, nextDate, Number(current.rows[0].setor_id), tipoBobina, Number(req.auth.userId),
        )) || id;
      }
    } else {
      await client.query('UPDATE apontamentos SET data = $1, atualizado_em = NOW() WHERE id = $2', [nextDate, id]);
      if (TURN_OCCURRENCE_SECTORS.has(setorNome)) {
        finalId = (await mergeTurnSectorDuplicateGroup(
          client, nextDate, Number(current.rows[0].setor_id), tipoBobina, Number(req.auth.userId),
        )) || id;
      }
    }

    await client.query('COMMIT');
    res.json(await loadApontamento(finalId));
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
async function cleanupUnusedImportedProduction(
  client: any,
  whereSql: string,
  params: any[],
  usedIds: Set<number>,
) {
  const previous = await client.query(
    `SELECT a.id,
            a.complementado,
            a.turno1_complementado,
            a.turno2_complementado,
            (
              EXISTS (SELECT 1 FROM paradas_falta_material pfm WHERE pfm.apontamento_id = a.id)
              OR EXISTS (SELECT 1 FROM paradas_maquina pm WHERE pm.apontamento_id = a.id)
              OR EXISTS (SELECT 1 FROM nao_conformidades nc WHERE nc.apontamento_id = a.id)
              OR EXISTS (SELECT 1 FROM faltas f WHERE f.apontamento_id = a.id)
              OR EXISTS (SELECT 1 FROM observacoes o WHERE o.apontamento_id = a.id)
            ) AS possui_complementos
       FROM apontamentos a
      WHERE a.origem_producao = 'IMPORTADO'
        AND ${whereSql}`,
    params,
  );

  for (const row of previous.rows) {
    const id = Number(row.id);
    if (usedIds.has(id)) continue;

    // Nunca apaga informações digitadas pelos apontadores. Se o registro não possui
    // complemento manual, pode ser removido por completo; caso contrário, apenas a
    // produção antiga é retirada e as ocorrências permanecem intactas.
    const possuiTurnoRegistrado = row.turno1_complementado === true || row.turno2_complementado === true;
    if (row.complementado === false && !possuiTurnoRegistrado && row.possui_complementos !== true) {
      await client.query('DELETE FROM apontamentos WHERE id = $1', [id]);
      continue;
    }

    await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
    await client.query('UPDATE apontamentos SET atualizado_em = NOW() WHERE id = $1', [id]);
  }
}

async function replaceImportedProductionForDate(
  client: any,
  data: string,
  groups: ImportGroup[],
  fallbackUserId: number,
  setorFiltro: ImportSectorFilter = 'ALL',
): Promise<{ usedIds: Set<number>; totalUnidades: number }> {
  const prepared = await prepareImportGroups(client, groups, fallbackUserId);
  const unitGroups = new Map<string, PreparedImportGroup[]>();
  for (const group of prepared) {
    // O apontamento importado é identificado por usuário + setor + tipo de bobina.
    // MPA pode ter EPO associado ao mesmo apontador de MON/TRI; nesse caso as linhas
    // permanecem juntas para evitar sobrescrita parcial na reimportação.
    const key = `${group.usuarioId}|${group.setorId}|${group.tipoBobina || ''}`;
    const bucket = unitGroups.get(key) || [];
    bucket.push(group);
    unitGroups.set(key, bucket);
  }

  const usedIds = new Set<number>();
  for (const unit of unitGroups.values()) {
    const first = unit[0];
    const tipoBobina = first.setor === 'BOBINA AT/BT' ? first.tipoBobina || null : null;
    const sectorSharedAcrossUsers = SHARED_IMPORT_SECTORS.has(first.setor);
    const turnSector = TURN_OCCURRENCE_SECTORS.has(first.setor);
    const turnSectorExistingId = turnSector
      ? await mergeTurnSectorDuplicateGroup(client, data, first.setorId, tipoBobina, first.usuarioId)
      : null;
    const existing = turnSectorExistingId
      ? { rows: [{ id: turnSectorExistingId }] }
      : sectorSharedAcrossUsers
        ? await client.query(
            `SELECT id, complementado
               FROM apontamentos
              WHERE data = $1
                AND setor_id = $2
                AND origem_producao = 'IMPORTADO'
                AND tipo_bobina IS NULL
              ORDER BY id DESC
              LIMIT 1`,
            [data, first.setorId],
          )
        : await client.query(
            `SELECT id, complementado
               FROM apontamentos
              WHERE data = $1
                AND usuario_id = $2
                AND setor_id = $3
                AND origem_producao = 'IMPORTADO'
                AND (($4::text IS NULL AND tipo_bobina IS NULL) OR tipo_bobina::text = $4::text)
              ORDER BY id DESC
              LIMIT 1`,
            [data, first.usuarioId, first.setorId, tipoBobina],
          );

    let apontamentoId: number;
    if (existing.rows.length) {
      apontamentoId = Number(existing.rows[0].id);
      // Preserva o estado de complemento existente. Isso é essencial quando as
      // ocorrências/turnos foram registrados antes da produção ser importada.
      await client.query(
        'UPDATE apontamentos SET atualizado_em = NOW() WHERE id = $1',
        [apontamentoId],
      );
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
        'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade, turno) VALUES($1, $2, $3, $4, $5)',
        [apontamentoId, group.linhaId, group.potencia, group.quantidade, group.turno || null],
      );
    }
  }

  if (setorFiltro === 'ALL') {
    await cleanupUnusedImportedProduction(client, 'a.data = $1::date', [data], usedIds);
  } else {
    await cleanupUnusedImportedProduction(
      client,
      'a.data = $1::date AND a.setor_id = (SELECT id FROM setores WHERE nome = $2 LIMIT 1)',
      [data, setorFiltro],
      usedIds,
    );
  }
  return { usedIds, totalUnidades: unitGroups.size };
}

app.post('/api/coordenacao/importar-producao', auth, requireCoordenacao, async (req: any, res) => {
  const client = await pool.connect();
  const data = String(req.body?.data || '').trim();
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'Informe uma data válida para a importação.' });

    let groups: ImportGroup[];
    let setorFiltro: ImportSectorFilter;
    try {
      groups = validateImportGroups(req.body?.grupos);
      setorFiltro = validateImportSectorFilter(req.body?.setorFiltro);
      if (setorFiltro !== 'ALL' && groups.some((group) => group.setor !== setorFiltro)) {
        throw new Error('Os grupos enviados não correspondem ao setor selecionado para importação.');
      }
    } catch (validationError) {
      return res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Dados de importação inválidos.' });
    }

    await client.query('BEGIN');
    const result = await replaceImportedProductionForDate(client, data, groups, Number(req.auth.userId), setorFiltro);
    await client.query('COMMIT');

    const ids = [...result.usedIds];
    // Na importação mensal fracionada, o frontend não precisa receber todos os
    // apontamentos completos a cada dia. Evitar essas leituras reduz centenas de
    // consultas e mantém cada requisição curta em ambientes serverless.
    const compacto = req.body?.compacto === true;
    const registros = compacto ? [] : await Promise.all(ids.map((id) => loadApontamento(id)));
    res.json({
      data,
      registros: registros.filter(Boolean),
      totalQuantidade: groups.reduce((sum, group) => sum + group.quantidade, 0),
      totalUnidades: result.totalUnidades,
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error(e);
    if (e?.code === '42703') {
      return res.status(500).json({ error: 'Execute o script NEON_TURNO_PRODUCAO.sql no Neon antes de importar a produção por turno.' });
    }
    res.status(500).json({ error: e instanceof Error ? e.message : 'Falha ao importar a produção.' });
  } finally {
    client.release();
  }
});

function validateProductionMonthImport(body: any): { mesReferencia: string; setorFiltro: ImportSectorFilter; dias: Array<{ data: string; grupos: ImportGroup[] }> } {
  const mesReferencia = String(body?.mesReferencia || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mesReferencia)) throw new Error('Mês de referência inválido.');
  const setorFiltro = validateImportSectorFilter(body?.setorFiltro);
  const rawDays = Array.isArray(body?.dias) ? body.dias : [];
  if (!rawDays.length) throw new Error('A importação mensal não possui dias válidos para importar.');

  const seen = new Set<string>();
  const dias = rawDays.map((day: any) => {
    const data = String(day?.data || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !data.startsWith(`${mesReferencia}-`)) {
      throw new Error(`Data fora do mês selecionado: ${data || 'não informada'}.`);
    }
    if (seen.has(data)) throw new Error(`A data ${data} foi enviada mais de uma vez na importação mensal.`);
    seen.add(data);
    const grupos = validateImportGroups(day?.grupos);
    if (setorFiltro !== 'ALL' && grupos.some((group) => group.setor !== setorFiltro)) {
      throw new Error(`A data ${data} contém grupos de outro setor além do setor selecionado.`);
    }
    return { data, grupos };
  });

  return { mesReferencia, setorFiltro, dias: dias.sort((a, b) => a.data.localeCompare(b.data)) };
}

function validateProductionMonthFinalize(body: any): { mesReferencia: string; setorFiltro: ImportSectorFilter; datasImportadas: string[] } {
  const mesReferencia = String(body?.mesReferencia || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mesReferencia)) throw new Error('Mês de referência inválido.');
  const setorFiltro = validateImportSectorFilter(body?.setorFiltro);
  const rawDates = Array.isArray(body?.datasImportadas) ? body.datasImportadas : [];
  if (!rawDates.length) throw new Error('Nenhuma data importada foi informada para finalizar o mês.');
  const datasImportadas: string[] = Array.from(
    new Set<string>(rawDates.map((value: any) => String(value || '').trim()))
  );
  for (const data of datasImportadas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !data.startsWith(`${mesReferencia}-`)) {
      throw new Error(`Data fora do mês selecionado: ${data || 'não informada'}.`);
    }
  }
  return { mesReferencia, setorFiltro, datasImportadas: datasImportadas.sort() };
}

// Etapa final da importação mensal fracionada. Os dias presentes no arquivo já
// foram substituídos individualmente; aqui são removidas apenas produções antigas
// de dias do mês que deixaram de existir no novo arquivo. Ocorrências digitadas
// pelos apontadores continuam preservadas pela mesma regra de cleanup existente.
app.post('/api/coordenacao/importar-producao-mes-finalizar', auth, requireCoordenacao, async (req: any, res) => {
  const client = await pool.connect();
  try {
    let payload: ReturnType<typeof validateProductionMonthFinalize>;
    try {
      payload = validateProductionMonthFinalize(req.body);
    } catch (validationError) {
      return res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Dados de finalização mensal inválidos.' });
    }

    await client.query('BEGIN');
    if (payload.setorFiltro === 'ALL') {
      await cleanupUnusedImportedProduction(
        client,
        "TO_CHAR(a.data, 'YYYY-MM') = $1 AND NOT (a.data = ANY($2::date[]))",
        [payload.mesReferencia, payload.datasImportadas],
        new Set<number>(),
      );
    } else {
      await cleanupUnusedImportedProduction(
        client,
        "TO_CHAR(a.data, 'YYYY-MM') = $1 AND NOT (a.data = ANY($2::date[])) AND a.setor_id = (SELECT id FROM setores WHERE nome = $3 LIMIT 1)",
        [payload.mesReferencia, payload.datasImportadas, payload.setorFiltro],
        new Set<number>(),
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Falha ao finalizar a importação mensal.' });
  } finally {
    client.release();
  }
});

app.post('/api/coordenacao/importar-producao-mes', auth, requireCoordenacao, async (req: any, res) => {
  const client = await pool.connect();
  try {
    let payload: ReturnType<typeof validateProductionMonthImport>;
    try {
      payload = validateProductionMonthImport(req.body);
    } catch (validationError) {
      return res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Dados de importação mensal inválidos.' });
    }

    await client.query('BEGIN');
    const allUsedIds = new Set<number>();
    let totalUnidades = 0;
    let totalQuantidade = 0;

    for (const day of payload.dias) {
      const result = await replaceImportedProductionForDate(client, day.data, day.grupos, Number(req.auth.userId), payload.setorFiltro);
      result.usedIds.forEach((id) => allUsedIds.add(id));
      totalUnidades += result.totalUnidades;
      totalQuantidade += day.grupos.reduce((sum, group) => sum + group.quantidade, 0);
    }

    // A opção mensal representa uma fotografia completa do mês. Portanto, qualquer
    // produção importada anteriormente no mesmo mês que não esteja no novo arquivo
    // também é removida, preservando ocorrências manuais vinculadas aos apontamentos.
    if (payload.setorFiltro === 'ALL') {
      await cleanupUnusedImportedProduction(
        client,
        "TO_CHAR(a.data, 'YYYY-MM') = $1",
        [payload.mesReferencia],
        allUsedIds,
      );
    } else {
      await cleanupUnusedImportedProduction(
        client,
        "TO_CHAR(a.data, 'YYYY-MM') = $1 AND a.setor_id = (SELECT id FROM setores WHERE nome = $2 LIMIT 1)",
        [payload.mesReferencia, payload.setorFiltro],
        allUsedIds,
      );
    }

    await client.query('COMMIT');
    // Compatibilidade com clientes antigos: mantém o endpoint mensal, mas evita
    // recarregar cada apontamento completo após a gravação. O frontend atual usa
    // a estratégia fracionada, mais resistente a timeout.
    res.json({
      mesReferencia: payload.mesReferencia,
      datasImportadas: payload.dias.length,
      registros: [],
      totalQuantidade,
      totalUnidades,
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error(e);
    if (e?.code === '42703') {
      return res.status(500).json({ error: 'Execute o script NEON_TURNO_PRODUCAO.sql no Neon antes de importar a produção por turno.' });
    }
    res.status(500).json({ error: e instanceof Error ? e.message : 'Falha ao importar a produção mensal.' });
  } finally {
    client.release();
  }
});

// Painel exclusivo da COORDENAÇÃO: consulta global.


type ProgramacaoImportGroup = {
  dataProgramada: string;
  setor: string;
  linha: string;
  potencia: string;
  quantidade: number;
};

function validateProgramacaoImport(body: any): { mesReferencia: string; monthDate: string; setorFiltro: ImportSectorFilter; grupos: ProgramacaoImportGroup[] } {
  const mesReferencia = String(body?.mesReferencia || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mesReferencia)) throw new Error('Mês de referência inválido.');
  const monthDate = `${mesReferencia}-01`;
  const setorFiltro = validateImportSectorFilter(body?.setorFiltro);
  const gruposRaw = Array.isArray(body?.grupos) ? body.grupos : [];
  if (!gruposRaw.length) throw new Error('A programação não possui grupos válidos para importar.');

  const grupos = gruposRaw.map((item: any) => {
    const dataProgramada = String(item?.dataProgramada || '').slice(0, 10);
    const setor = String(item?.setor || '').trim();
    const linha = String(item?.linha || '').trim();
    const potencia = String(item?.potencia ?? '').trim();
    const quantidade = Number(item?.quantidade);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataProgramada) || !dataProgramada.startsWith(`${mesReferencia}-`)) {
      throw new Error(`Data programada fora do mês selecionado: ${dataProgramada || 'não informada'}.`);
    }
    if (!setor || !linha || !potencia) throw new Error('Setor, linha e potência são obrigatórios na programação consolidada.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error('Quantidade inválida na programação consolidada.');
    if (setorFiltro !== 'ALL' && normalizeProgramacaoImportSector(setor) !== setorFiltro) {
      throw new Error(`O setor ${setor} não corresponde ao setor selecionado para importação.`);
    }
    return { dataProgramada, setor, linha, potencia, quantidade };
  });

  return { mesReferencia, monthDate, setorFiltro, grupos };
}

app.post('/api/coordenacao/importar-programacao', auth, requireCoordenacao, async (req: any, res) => {
  let client: any;
  try {
    const { mesReferencia, monthDate, setorFiltro, grupos } = validateProgramacaoImport(req.body);
    client = await pool.connect();
    await client.query('BEGIN');
    if (setorFiltro === 'ALL') {
      await client.query('DELETE FROM programacao WHERE mes_referencia = $1::date', [monthDate]);
    } else {
      const existingSectors = await client.query(
        'SELECT DISTINCT setor FROM programacao WHERE mes_referencia = $1::date',
        [monthDate],
      );
      const sectorsToReplace = existingSectors.rows
        .map((row: any) => String(row.setor || ''))
        .filter((setor: string) => normalizeProgramacaoImportSector(setor) === setorFiltro);
      if (sectorsToReplace.length) {
        await client.query(
          'DELETE FROM programacao WHERE mes_referencia = $1::date AND setor = ANY($2::text[])',
          [monthDate, sectorsToReplace],
        );
      }
    }

    const chunkSize = 400;
    for (let start = 0; start < grupos.length; start += chunkSize) {
      const chunk = grupos.slice(start, start + chunkSize);
      const values: any[] = [];
      const placeholders = chunk.map((group, index) => {
        const base = index * 6;
        values.push(monthDate, group.dataProgramada, group.setor, group.linha, group.potencia, group.quantidade);
        return `($${base + 1}::date,$${base + 2}::date,$${base + 3},$${base + 4},$${base + 5},$${base + 6}::integer)`;
      });
      await client.query(
        `INSERT INTO programacao(mes_referencia, data_programada, setor, linha, potencia, quantidade)
         VALUES ${placeholders.join(',')}`,
        values,
      );
    }

    await client.query('COMMIT');
    res.json({
      mesReferencia,
      grupos: grupos.length,
      totalQuantidade: grupos.reduce((sum, group) => sum + group.quantidade, 0),
    });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Falha ao importar a programação.' });
  } finally {
    client?.release?.();
  }
});

function normalizeDashboardSector(setor: string): string {
  return String(setor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function dashboardSectorName(setor: string, tipoBobina?: string | null): string {
  const value = normalizeDashboardSector(setor);
  if (value === 'BOBINA AT/BT') return String(tipoBobina || '').toUpperCase() === 'BT' ? 'BOBINA BT' : 'BOBINA AT';
  if (value === 'CORTE LASER') return 'CORTE DO LASER';
  if (value === 'MONTAGEM NUCLEO') return 'MONTAGEM DO NUCLEO';
  if (value === 'CORTE DO NUCLEO' || value === 'CORTE NUCLEO') return 'CORTE DO NUCLEO';
  if (value === 'FERRAGEM PA' || value === 'FERRAGEM PA / ACESSORIOS' || value === 'FERRAGEM PA/ACESSORIOS') return 'FERRAGEM';
  return value;
}

function dashboardTurno(value: any): string {
  const raw = String(value || '').trim().replace(/\s*turno$/i, '').trim().toLowerCase();
  if (!raw) return '';
  if (['1', '1º', 'primeiro'].includes(raw)) return '1º';
  if (['2', '2º', 'segundo'].includes(raw)) return '2º';
  return raw;
}

function occurrenceDashboardSector(setor: string, tipoBobina?: string | null): string | null {
  const base = dashboardSectorName(setor, tipoBobina);
  return base === 'ESTAMPARIA' ? null : base;
}

function expandedDashboardSectors(setor: string, linha?: string | null, tipoBobina?: string | null): string[] {
  const base = dashboardSectorName(setor, tipoBobina);
  if (base === 'ESTAMPARIA') return [];
  const line = String(linha || '').trim().toUpperCase();
  const sectors = [base];
  // Montagem Final + EPO participa simultaneamente da visão de Montagem Final e da visão específica de Epóxi.
  if (base === 'MONTAGEM FINAL' && line === 'EPO') sectors.push('EPOXI');
  if (base === 'EPOXI') sectors.push('MONTAGEM FINAL');
  return [...new Set(sectors)];
}

function dashboardAccessSectorNames(setor: string): string[] {
  const value = String(setor || '').trim().toUpperCase();
  if (value === 'BOBINA AT/BT') return ['BOBINA AT', 'BOBINA BT'];
  return [dashboardSectorName(value)];
}

function absenceSectorName(setor: string): string | null {
  const value = normalizeDashboardSector(setor);
  if (['BOBINA AT/BT', 'BOBINA AT', 'BOBINA BT'].includes(value)) return 'BOBINAGEM';
  if (value === 'CORTE LASER') return 'CORTE DO LASER';
  if (value === 'MONTAGEM NUCLEO') return 'MONTAGEM DO NUCLEO';
  if (value === 'CORTE DO NUCLEO' || value === 'CORTE NUCLEO') return 'CORTE DO NUCLEO';
  if (value === 'FERRAGEM PA' || value === 'FERRAGEM PA / ACESSORIOS' || value === 'FERRAGEM PA/ACESSORIOS') return 'FERRAGEM';
  return value === 'ESTAMPARIA' ? null : value;
}

app.get('/api/coordenacao/controle-faltas', auth, requireCoordenacao, async (req: any, res) => {
  try {
    const dataInicio = String(req.query.dataInicio || '').trim();
    const dataFim = String(req.query.dataFim || '').trim();
    const ymdPattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!ymdPattern.test(dataInicio) || !ymdPattern.test(dataFim) || dataInicio > dataFim) {
      res.status(400).json({ error: 'Informe um período válido para consultar o Controle de Faltas.' });
      return;
    }

    const result = await pool.query(`
      SELECT f.id, f.apontamento_id, a.data, s.nome setor, l.nome linha,
             f.turno, f.quantidade, f.nome, f.motivo_justificativa, f.atestado
        FROM faltas f
        JOIN apontamentos a ON a.id = f.apontamento_id
        JOIN setores s ON s.id = a.setor_id
        LEFT JOIN linhas l ON l.id = f.linha_id
       WHERE a.status_aprovacao = 'APROVADO'
         AND a.data BETWEEN $1::date AND $2::date
       ORDER BY a.data, s.nome, f.id
    `, [dataInicio, dataFim]);

    const registros = result.rows.flatMap((row: any) => {
      const nome = String(row.nome || '').trim();
      const setor = absenceSectorName(String(row.setor || ''));
      const quantidade = row.quantidade == null ? (nome ? 1 : 0) : Math.max(0, Number(row.quantidade) || 0);
      if (!setor || quantidade <= 0) return [];

      return [{
        id: String(row.id),
        apontamentoId: String(row.apontamento_id),
        data: dateOnly(row.data),
        setor,
        linha: row.linha ? String(row.linha).trim() : undefined,
        turno: dashboardTurno(row.turno) || undefined,
        quantidade,
        nome,
        motivoJustificativa: String(row.motivo_justificativa || '').trim(),
        atestado: row.atestado === true,
      }];
    });

    res.json({
      geradoEm: new Date().toISOString(),
      registros,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar os dados do Controle de Faltas.' });
  }
});

app.get('/api/coordenacao/dashboard', auth, async (req: any, res) => {
  try {
    await repairAllTurnSectorDuplicates();
    const isCoordination = req.auth?.perfil === 'COORDENACAO';
    const accessRows = isCoordination ? [] : await getUserAccess(req.auth.userId);
    const allowedDashboardSectors = new Set<string>(
      accessRows.flatMap((row: any) => dashboardAccessSectorNames(String(row.setor || ''))),
    );
    const allowedLines = new Set<string>(
      accessRows.map((row: any) => String(row.linha || '').trim().toUpperCase()).filter(Boolean),
    );
    const accessSectorNames: string[] = Array.from(
      new Set<string>(accessRows.map((row: any) => String(row.setor || '').trim().toUpperCase())),
    );
    const restrictLine = !isCoordination
      && accessSectorNames.length > 0
      && accessSectorNames.every((setor) => ['MONTAGEM FINAL', 'MPA', 'EPOXI'].includes(setor))
      && allowedLines.size === 1;

    const dashboardItemAllowed = (setor: string, linha?: string | null) => {
      if (isCoordination) return true;
      if (!allowedDashboardSectors.has(setor)) return false;
      const normalizedLine = String(linha || '').trim().toUpperCase();
      if (restrictLine && normalizedLine && !allowedLines.has(normalizedLine)) return false;
      return true;
    };

    const rawApontamentoAllowed = (row: any) => isCoordination || Number(row.user_id) === Number(req.auth.userId);
    const userQueryParams = isCoordination ? [] : [req.auth.userId];
    const productionScopeSql = isCoordination ? '' : 'WHERE a.usuario_id = $1';
    const approvedScopeSql = isCoordination
      ? "WHERE a.status_aprovacao = 'APROVADO'"
      : "WHERE a.status_aprovacao = 'APROVADO' AND a.usuario_id = $1";

    const [monthsResult, programacaoResult, producaoResult, faltasResult, observacoesResult, materialResult, maquinaResult, ncResult] = await Promise.all([
      isCoordination
        ? pool.query(`
            SELECT mes FROM (
              SELECT TO_CHAR(mes_referencia, 'YYYY-MM') mes FROM programacao
              UNION
              SELECT TO_CHAR(data, 'YYYY-MM') mes FROM apontamentos
            ) x
            WHERE mes IS NOT NULL
            ORDER BY mes
          `)
        : Promise.resolve({ rows: [] as any[] }),
      pool.query(`
        SELECT data_programada, setor, linha, SUM(quantidade)::int quantidade
          FROM programacao
         GROUP BY data_programada, setor, linha
         ORDER BY data_programada, setor, linha
      `),
      pool.query(`
        SELECT a.data, a.usuario_id AS user_id, s.nome setor, a.tipo_bobina, l.nome linha, p.potencia, p.quantidade, p.turno
          FROM producao p
          JOIN apontamentos a ON a.id = p.apontamento_id
          JOIN setores s ON s.id = a.setor_id
          JOIN linhas l ON l.id = p.linha_id
         ${productionScopeSql}
         ORDER BY a.data, s.nome, l.nome, p.potencia
      `, userQueryParams),
      pool.query(`
        SELECT a.data, a.usuario_id AS user_id, s.nome setor, a.tipo_bobina, l.nome linha, f.turno, f.quantidade,
               f.nome, f.motivo_justificativa, f.atestado
          FROM faltas f
          JOIN apontamentos a ON a.id = f.apontamento_id
          JOIN setores s ON s.id = a.setor_id
          LEFT JOIN linhas l ON l.id = f.linha_id
         ${approvedScopeSql}
         ORDER BY a.data, s.nome, f.id
      `, userQueryParams),
      pool.query(`
        SELECT a.data, a.usuario_id AS user_id, s.nome setor, a.tipo_bobina, l.nome linha, o.turno, o.observacao, o.justificativa_meta
          FROM observacoes o
          JOIN apontamentos a ON a.id = o.apontamento_id
          JOIN setores s ON s.id = a.setor_id
          LEFT JOIN linhas l ON l.id = o.linha_id
         ${approvedScopeSql}
         ORDER BY a.data, s.nome, o.id
      `, userQueryParams),
      pool.query(`
        SELECT a.data, a.usuario_id AS user_id, s.nome setor, a.tipo_bobina, pfm.causa_motivo, pfm.material, pfm.hora_inicio, pfm.hora_fim, pfm.turno
          FROM paradas_falta_material pfm
          JOIN apontamentos a ON a.id = pfm.apontamento_id
          JOIN setores s ON s.id = a.setor_id
         ${approvedScopeSql}
         ORDER BY a.data, s.nome, pfm.id
      `, userQueryParams),
      pool.query(`
        SELECT a.data, a.usuario_id AS user_id, s.nome setor, a.tipo_bobina, pm.maquina_equipamento, pm.hora_inicio, pm.hora_fim, pm.observacao, pm.turno
          FROM paradas_maquina pm
          JOIN apontamentos a ON a.id = pm.apontamento_id
          JOIN setores s ON s.id = a.setor_id
         ${approvedScopeSql}
         ORDER BY a.data, s.nome, pm.id
      `, userQueryParams),
      pool.query(`
        SELECT a.data, a.usuario_id AS user_id, s.nome setor, a.tipo_bobina, nc.causa_nao_conformidade, nc.op, nc.numero_serie, nc.turno
          FROM nao_conformidades nc
          JOIN apontamentos a ON a.id = nc.apontamento_id
          JOIN setores s ON s.id = a.setor_id
         ${approvedScopeSql}
         ORDER BY a.data, s.nome, nc.id
      `, userQueryParams),
    ]);

    const programacao: any[] = [];
    for (const row of programacaoResult.rows) {
      const linha = String(row.linha || '').trim();
      for (const setor of expandedDashboardSectors(String(row.setor), linha)) {
        if (!dashboardItemAllowed(setor, linha)) continue;
        programacao.push({ data: dateOnly(row.data_programada), linha, setor, quantidade: Number(row.quantidade) || 0 });
      }
    }

    const detalhesProducao: any[] = [];
    const apontamentoMap = new Map<string, any>();
    for (const row of producaoResult.rows) {
      if (!rawApontamentoAllowed(row)) continue;
      const linha = String(row.linha || '').trim();
      const data = dateOnly(row.data);
      const quantidade = Number(row.quantidade) || 0;
      const turno = dashboardTurno(row.turno) || 'Todos';
      for (const setor of expandedDashboardSectors(String(row.setor), linha, row.tipo_bobina)) {
        if (!dashboardItemAllowed(setor, linha)) continue;
        detalhesProducao.push({ data, linha, setor, potencia: Number(row.potencia), quantidade, turno: turno === 'Todos' ? undefined : turno });
        const key = `${data}|${setor}|${linha}|${turno}`;
        const current = apontamentoMap.get(key) || { data, linha, setor, turno, quantidade: 0 };
        current.quantidade += quantidade;
        apontamentoMap.set(key, current);
      }
    }
    const apontamento = [...apontamentoMap.values()];

    const faltas: any[] = [];
    const detalhesFaltas: any[] = [];
    for (const row of faltasResult.rows) {
      if (!rawApontamentoAllowed(row)) continue;
      const data = dateOnly(row.data);
      const linha = String(row.linha || '').trim();
      const turno = dashboardTurno(row.turno) || 'Todos';
      const quantidade = row.quantidade == null ? (String(row.nome || '').trim() ? 1 : 0) : Number(row.quantidade) || 0;
      const setor = occurrenceDashboardSector(String(row.setor), row.tipo_bobina);
      if (!setor || !dashboardItemAllowed(setor, linha)) continue;
      faltas.push({ data, linha, setor, turno, quantidade });
      detalhesFaltas.push({
        data, setor, linha: linha || undefined, turno: turno === 'Todos' ? undefined : turno,
        quantidade: row.quantidade == null ? null : Number(row.quantidade),
        nome: row.nome || '', motivoJustificativa: row.motivo_justificativa || '',
        atestado: typeof row.atestado === 'boolean' ? (row.atestado ? 'Sim' : 'Não') : '',
      });
    }

    const observacoes: any[] = [];
    const detalhesObservacoes: any[] = [];
    for (const row of observacoesResult.rows) {
      if (!rawApontamentoAllowed(row)) continue;
      const data = dateOnly(row.data);
      const linha = String(row.linha || '').trim();
      const setor = occurrenceDashboardSector(String(row.setor), row.tipo_bobina);
      if (!setor || !dashboardItemAllowed(setor, linha)) continue;
      const turno = dashboardTurno(row.turno) || undefined;
      const item = { data, linha, setor, turno, observacao: row.observacao || '', justificativaMeta: row.justificativa_meta || '' };
      observacoes.push(item);
      detalhesObservacoes.push(item);
    }

    const faltasMaterial: any[] = [];
    for (const row of materialResult.rows) {
      if (!rawApontamentoAllowed(row)) continue;
      const setor = occurrenceDashboardSector(String(row.setor), row.tipo_bobina);
      if (!setor || !dashboardItemAllowed(setor)) continue;
      faltasMaterial.push({ data: dateOnly(row.data), setor, turno: dashboardTurno(row.turno) || undefined, causaMotivo: row.causa_motivo || '', material: row.material || '', horaInicio: String(row.hora_inicio || '').slice(0,5), horaFim: String(row.hora_fim || '').slice(0,5) });
    }

    const maquinasQuebradas: any[] = [];
    for (const row of maquinaResult.rows) {
      if (!rawApontamentoAllowed(row)) continue;
      const setor = occurrenceDashboardSector(String(row.setor), row.tipo_bobina);
      if (!setor || !dashboardItemAllowed(setor)) continue;
      maquinasQuebradas.push({ data: dateOnly(row.data), setor, turno: dashboardTurno(row.turno) || undefined, maquinaEquipamento: row.maquina_equipamento || '', horaInicio: String(row.hora_inicio || '').slice(0,5), horaFim: String(row.hora_fim || '').slice(0,5), observacao: row.observacao || '' });
    }

    const naoConformidades: any[] = [];
    for (const row of ncResult.rows) {
      if (!rawApontamentoAllowed(row)) continue;
      const setor = occurrenceDashboardSector(String(row.setor), row.tipo_bobina);
      if (!setor || !dashboardItemAllowed(setor)) continue;
      naoConformidades.push({ data: dateOnly(row.data), setor, turno: dashboardTurno(row.turno) || undefined, causa: row.causa_nao_conformidade || '', op: row.op || '', numeroSerie: row.numero_serie || '' });
    }

    const linhas = [...new Set([...programacao, ...apontamento].map((row: any) => row.linha).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    const setores = [...new Set([...programacao, ...apontamento].map((row: any) => row.setor).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    const turnos = [...new Set([...apontamento, ...faltas, ...observacoes, ...faltasMaterial, ...maquinasQuebradas, ...naoConformidades].map((row: any) => row.turno).filter((value: any) => Boolean(value) && value !== 'Todos'))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

    const mesesVisiveis = isCoordination
      ? monthsResult.rows.map((row: any) => String(row.mes)).filter(Boolean)
      : [...new Set([...programacao, ...apontamento].map((row: any) => String(row.data || '').slice(0, 7)).filter(Boolean))].sort();

    res.json({
      geradoEm: new Date().toISOString(),
      periodo: { meses: mesesVisiveis },
      filtros: { linhas, setores, turnos },
      escopo: isCoordination ? null : {
        setores: [...allowedDashboardSectors],
        linhas: restrictLine ? [...allowedLines] : [],
      },
      programacao,
      apontamento,
      detalhesProducao,
      faltas,
      observacoes,
      detalhesFaltas,
      detalhesObservacoes,
      faltasMaterial,
      maquinasQuebradas,
      naoConformidades,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar os dados do Dashboard de Aderência.' });
  }
});

app.get('/api/coordenacao/apontamentos', auth, requireCoordenacao, async (_req: any, res) => {
  try {
    await repairAllTurnSectorDuplicates();
    const registros = await loadApontamentosBatch();
    res.json(registros);
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
      `SELECT a.id, a.usuario_id, a.setor_id, a.data, a.origem_producao, a.tipo_bobina, s.nome setor,
              EXISTS(SELECT 1 FROM producao p WHERE p.apontamento_id = a.id) AS possui_producao
         FROM apontamentos a
         JOIN setores s ON s.id = a.setor_id
        WHERE a.id = $1`,
      [id],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Registro não encontrado.' });

    const isImported = String(current.rows[0].origem_producao || '').toUpperCase() === 'IMPORTADO';
    const hasProduction = current.rows[0].possui_producao === true;
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
    // A data fica bloqueada somente depois que existe produção importada. Enquanto o
    // registro contém apenas ocorrências antecipadas, a Coordenação pode corrigir a
    // data caso o apontador tenha lançado no dia errado.
    const lockImportedDate = isImported && hasProduction;
    const originalDate = dateOnly(current.rows[0].data);
    const nextDate = lockImportedDate ? originalDate : dateOnly(data.data);
    const setorNome = String(current.rows[0].setor || '').trim().toUpperCase();
    const tipoBobina = current.rows[0].tipo_bobina ? String(current.rows[0].tipo_bobina) : null;

    // Primeiro atualiza o conteúdo do cartão que está sendo editado, sem trocar a
    // data. Se o dia de destino já possuir um cartão da mesma unidade operacional,
    // o conteúdo será incorporado diretamente a ele, sem deixar dois cartões.
    await client.query(
      `UPDATE apontamentos
          SET complementado = CASE WHEN $2::boolean THEN TRUE ELSE complementado END,
              atualizado_em = NOW(),
              status_aprovacao = 'PENDENTE',
              aprovado_em = NULL,
              aprovado_por = NULL
        WHERE id = $1`,
      [id, lockImportedDate],
    );

    if (!isImported) {
      await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
      for (const item of occurrenceList(data.producoes)) {
        await client.query(
          'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade, turno) VALUES($1, $2, $3, $4, $5)',
          [id, lineMap.get(item.linha), item.potencia, item.quantidade, dashboardTurno(item.turno) || null],
        );
      }
    }
    await deleteOccurrenceCollections(client, id, data);
    await insertOccurrenceCollections(client, id, data, lineMap);

    let finalId = id;
    if (nextDate !== originalDate && TURN_OCCURRENCE_SECTORS.has(setorNome)) {
      // Consolida primeiro qualquer duplicidade já existente no dia correto. Depois,
      // incorpora o cartão cuja data está sendo corrigida ao cartão canônico.
      const targetId = await mergeTurnSectorDuplicateGroup(
        client,
        nextDate,
        Number(current.rows[0].setor_id),
        tipoBobina,
        Number(current.rows[0].usuario_id),
      );
      if (targetId && targetId !== id) {
        finalId = await mergeApontamentoIntoCanonical(client, targetId, id);
      } else {
        await client.query('UPDATE apontamentos SET data = $1, atualizado_em = NOW() WHERE id = $2', [nextDate, id]);
        finalId = (await mergeTurnSectorDuplicateGroup(
          client, nextDate, Number(current.rows[0].setor_id), tipoBobina, Number(current.rows[0].usuario_id),
        )) || id;
      }
    } else {
      await client.query('UPDATE apontamentos SET data = $1, atualizado_em = NOW() WHERE id = $2', [nextDate, id]);
      if (TURN_OCCURRENCE_SECTORS.has(setorNome)) {
        finalId = (await mergeTurnSectorDuplicateGroup(
          client, nextDate, Number(current.rows[0].setor_id), tipoBobina, Number(current.rows[0].usuario_id),
        )) || id;
      }
    }

    await client.query('COMMIT');
    res.json(await loadApontamento(finalId));
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
        `SELECT a.origem_producao, a.complementado,
                EXISTS(SELECT 1 FROM producao p WHERE p.apontamento_id = a.id) AS possui_producao
           FROM apontamentos a
          WHERE a.id = $1`,
        [id],
      );
      if (!readiness.rows.length) return res.status(404).json({ error: 'Registro não encontrado.' });
      if (readiness.rows[0].possui_producao !== true) {
        return res.status(409).json({ error: 'A produção ainda não foi importada para este apontamento.' });
      }
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

app.post('/api/coordenacao/excluir-apontamentos', auth, requireCoordenacao, async (req: any, res) => {
  const data = String(req.body?.data || '').trim();
  const mesReferencia = String(req.body?.mesReferencia || '').trim();
  const setorRaw = String(req.body?.setor || '').trim();
  const setor = setorRaw && setorRaw.toUpperCase() !== 'ALL' ? setorRaw.toUpperCase() : '';

  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ error: 'Informe uma data válida para a exclusão.' });
  }
  if (mesReferencia && !/^\d{4}-\d{2}$/.test(mesReferencia)) {
    return res.status(400).json({ error: 'Informe um mês válido para a exclusão.' });
  }
  if (data && mesReferencia) {
    return res.status(400).json({ error: 'Escolha exclusão por dia ou por mês, não os dois ao mesmo tempo.' });
  }
  if (!data && !mesReferencia && !setor) {
    return res.status(400).json({ error: 'Informe pelo menos um filtro: dia, mês ou setor.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const params: any[] = [];
    const where: string[] = [];
    if (data) {
      params.push(data);
      where.push(`a.data = $${params.length}::date`);
    }
    if (mesReferencia) {
      params.push(mesReferencia);
      where.push(`TO_CHAR(a.data, 'YYYY-MM') = $${params.length}`);
    }
    if (setor) {
      if (setor === 'BOBINA AT' || setor === 'BOBINA BT') {
        const tipoBobina = setor.endsWith('AT') ? 'AT' : 'BT';
        params.push('BOBINA AT/BT');
        where.push(`UPPER(s.nome) = $${params.length}`);
        params.push(tipoBobina);
        where.push(`UPPER(COALESCE(a.tipo_bobina::text, '')) = $${params.length}`);
      } else {
        params.push(setor);
        where.push(`UPPER(s.nome) = $${params.length}`);
      }
    }

    const targets = await client.query(
      `SELECT a.id
         FROM apontamentos a
         JOIN setores s ON s.id = a.setor_id
        WHERE ${where.join(' AND ')}
        FOR UPDATE OF a`,
      params,
    );
    const ids = targets.rows.map((row: any) => Number(row.id)).filter(Number.isFinite);
    if (!ids.length) {
      await client.query('COMMIT');
      return res.json({ ok: true, totalExcluidos: 0 });
    }

    // Remove explicitamente as coleções dependentes para funcionar tanto em bancos
    // com ON DELETE CASCADE quanto em instalações antigas sem essa restrição.
    for (const table of ['producao', 'paradas_falta_material', 'paradas_maquina', 'nao_conformidades', 'faltas', 'observacoes']) {
      await client.query(`DELETE FROM ${table} WHERE apontamento_id = ANY($1::bigint[])`, [ids]);
    }
    const deleted = await client.query('DELETE FROM apontamentos WHERE id = ANY($1::bigint[]) RETURNING id', [ids]);
    await client.query('COMMIT');
    res.json({ ok: true, totalExcluidos: deleted.rowCount || 0 });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(e);
    res.status(500).json({ error: 'Falha ao excluir os apontamentos selecionados.' });
  } finally {
    client.release();
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
