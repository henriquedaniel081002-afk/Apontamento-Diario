import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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

async function loadApontamento(id: number) {
  const h = await pool.query(
    `SELECT a.id, a.data, a.usuario_id, a.setor_id, u.login usuario, s.nome setor,
            a.criado_em, a.atualizado_em
       FROM apontamentos a
       JOIN usuarios u ON u.id = a.usuario_id
       JOIN setores s ON s.id = a.setor_id
      WHERE a.id = $1`,
    [id],
  );

  if (!h.rows.length) return null;
  const x = h.rows[0];

  const [p, f, o, acessos] = await Promise.all([
    pool.query(
      `SELECT p.id, l.nome linha, p.potencia, p.quantidade
         FROM producao p
         JOIN linhas l ON l.id = p.linha_id
        WHERE p.apontamento_id = $1
        ORDER BY p.id`,
      [id],
    ),
    pool.query(
      `SELECT f.id, l.nome linha, f.turno, f.quantidade, f.justificativa
         FROM faltas f
         JOIN linhas l ON l.id = f.linha_id
        WHERE f.apontamento_id = $1
        ORDER BY f.id`,
      [id],
    ),
    pool.query(
      `SELECT o.id, l.nome linha, o.turno, o.observacao
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

  return {
    id: String(x.id),
    data: dateOnly(x.data),
    setor: x.setor,
    userId: String(x.usuario_id),
    userName: x.usuario,
    linhasPermitidas: acessos.rows.map((r: any) => r.linha).filter(Boolean),
    producoes: p.rows.map((r: any) => ({
      id: String(r.id),
      linha: r.linha,
      potencia: Number(r.potencia),
      potenciaFormatted: String(r.potencia).replace('.', ','),
      quantidade: r.quantidade,
    })),
    faltas: f.rows.map((r: any) => ({
      id: String(r.id),
      linha: r.linha,
      turno: String(r.turno || '').toLowerCase(),
      quantidade: r.quantidade ?? 0,
      justificativa: r.justificativa || undefined,
    })),
    observacoes: o.rows.map((r: any) => ({
      id: String(r.id),
      linha: r.linha,
      turno: String(r.turno || '').toLowerCase(),
      observacao: r.observacao || '',
    })),
    createdAt: isoDateTime(x.criado_em),
    updatedAt: isoDateTime(x.atualizado_em),
  };
}

app.get('/api/apontamentos', auth, async (req: any, res) => {
  try {
    const ids = await pool.query(
      'SELECT id FROM apontamentos WHERE usuario_id = $1 ORDER BY data DESC, id DESC',
      [req.auth.userId],
    );
    const registros = await Promise.all(ids.rows.map((r: any) => loadApontamento(r.id)));
    res.json(registros.filter(Boolean));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar histórico.' });
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

app.post('/api/apontamentos', auth, async (req: any, res) => {
  if (req.auth?.perfil === 'COORDENACAO') {
    return res.status(403).json({ error: 'A COORDENAÇÃO deve editar registros pela tela de consulta geral.' });
  }

  const data = req.body;
  const client = await pool.connect();

  try {
    if (!data?.data) return res.status(400).json({ error: 'A data é obrigatória.' });

    const access = await getUserAccess(req.auth.userId);
    if (!access.length) return res.status(403).json({ error: 'Usuário sem acesso configurado.' });

    const setorId = access[0].setor_id;
    const allowed = new Map(access.map((a: any) => [a.linha, a.linha_id]));

    for (const item of [...(data.producoes || []), ...(data.faltas || []), ...(data.observacoes || [])]) {
      if (item.linha && !allowed.has(item.linha)) {
        return res.status(403).json({ error: `Linha ${item.linha} não permitida.` });
      }
    }

    await client.query('BEGIN');
    const up = await client.query(
      `INSERT INTO apontamentos(data, usuario_id, setor_id)
       VALUES($1, $2, $3)
       ON CONFLICT(data, usuario_id, setor_id)
       DO UPDATE SET atualizado_em = NOW()
       RETURNING id`,
      [data.data, req.auth.userId, setorId],
    );

    const id = up.rows[0].id;
    await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
    await client.query('DELETE FROM faltas WHERE apontamento_id = $1', [id]);
    await client.query('DELETE FROM observacoes WHERE apontamento_id = $1', [id]);

    for (const p of data.producoes || []) {
      await client.query(
        'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade) VALUES($1, $2, $3, $4)',
        [id, allowed.get(p.linha), p.potencia, p.quantidade],
      );
    }

    for (const f of data.faltas || []) {
      await client.query(
        'INSERT INTO faltas(apontamento_id, linha_id, turno, quantidade, justificativa) VALUES($1, $2, $3, $4, $5)',
        [id, allowed.get(f.linha), String(f.turno).toUpperCase(), f.quantidade ?? null, f.justificativa || null],
      );
    }

    for (const o of data.observacoes || []) {
      await client.query(
        'INSERT INTO observacoes(apontamento_id, linha_id, turno, observacao) VALUES($1, $2, $3, $4)',
        [id, o.linha ? allowed.get(o.linha) : null, String(o.turno).toUpperCase(), o.observacao || null],
      );
    }

    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Falha ao salvar apontamento.' });
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

    const current = await client.query(
      'SELECT id, usuario_id, setor_id FROM apontamentos WHERE id = $1 AND usuario_id = $2',
      [id, req.auth.userId],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Registro não encontrado ou sem permissão para edição.' });

    const access = await getUserAccess(req.auth.userId);
    if (!access.length) return res.status(403).json({ error: 'Usuário sem acesso configurado.' });

    const setorId = current.rows[0].setor_id;
    const allowed = new Map(
      access
        .filter((a: any) => Number(a.setor_id) === Number(setorId))
        .map((a: any) => [a.linha, a.linha_id]),
    );

    const allItems = [...(data.producoes || []), ...(data.faltas || []), ...(data.observacoes || [])];
    for (const item of allItems) {
      if (item.linha && !allowed.has(item.linha)) {
        return res.status(403).json({ error: `Linha ${item.linha} não permitida para este usuário/setor.` });
      }
    }

    await client.query('BEGIN');
    await client.query(
      'UPDATE apontamentos SET data = $1, atualizado_em = NOW() WHERE id = $2 AND usuario_id = $3',
      [data.data, id, req.auth.userId],
    );

    await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
    await client.query('DELETE FROM faltas WHERE apontamento_id = $1', [id]);
    await client.query('DELETE FROM observacoes WHERE apontamento_id = $1', [id]);

    for (const p of data.producoes || []) {
      await client.query(
        'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade) VALUES($1, $2, $3, $4)',
        [id, allowed.get(p.linha), p.potencia, p.quantidade],
      );
    }

    for (const f of data.faltas || []) {
      await client.query(
        'INSERT INTO faltas(apontamento_id, linha_id, turno, quantidade, justificativa) VALUES($1, $2, $3, $4, $5)',
        [id, allowed.get(f.linha), String(f.turno).toUpperCase(), f.quantidade ?? null, f.justificativa || null],
      );
    }

    for (const o of data.observacoes || []) {
      await client.query(
        'INSERT INTO observacoes(apontamento_id, linha_id, turno, observacao) VALUES($1, $2, $3, $4)',
        [id, o.linha ? allowed.get(o.linha) : null, String(o.turno).toUpperCase(), o.observacao || null],
      );
    }

    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error(e);
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'Já existe um apontamento desse usuário/setor para a data informada.' });
    }
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

    const current = await client.query(
      'SELECT id, usuario_id, setor_id FROM apontamentos WHERE id = $1',
      [id],
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Registro não encontrado.' });

    const allItems = [...(data.producoes || []), ...(data.faltas || []), ...(data.observacoes || [])];
    const lineNames = [...new Set(allItems.map((item: any) => item.linha).filter(Boolean))];
    const lines = lineNames.length
      ? await client.query('SELECT id, nome FROM linhas WHERE nome = ANY($1::text[])', [lineNames])
      : { rows: [] as any[] };
    const lineMap = new Map(lines.rows.map((r: any) => [r.nome, r.id]));

    for (const name of lineNames) {
      if (!lineMap.has(name)) return res.status(400).json({ error: `Linha ${name} não encontrada no banco.` });
    }

    await client.query('BEGIN');
    await client.query(
      'UPDATE apontamentos SET data = $1, atualizado_em = NOW() WHERE id = $2',
      [data.data, id],
    );

    await client.query('DELETE FROM producao WHERE apontamento_id = $1', [id]);
    await client.query('DELETE FROM faltas WHERE apontamento_id = $1', [id]);
    await client.query('DELETE FROM observacoes WHERE apontamento_id = $1', [id]);

    for (const p of data.producoes || []) {
      await client.query(
        'INSERT INTO producao(apontamento_id, linha_id, potencia, quantidade) VALUES($1, $2, $3, $4)',
        [id, lineMap.get(p.linha), p.potencia, p.quantidade],
      );
    }

    for (const f of data.faltas || []) {
      await client.query(
        'INSERT INTO faltas(apontamento_id, linha_id, turno, quantidade, justificativa) VALUES($1, $2, $3, $4, $5)',
        [id, lineMap.get(f.linha), String(f.turno).toUpperCase(), f.quantidade ?? null, f.justificativa || null],
      );
    }

    for (const o of data.observacoes || []) {
      await client.query(
        'INSERT INTO observacoes(apontamento_id, linha_id, turno, observacao) VALUES($1, $2, $3, $4)',
        [id, o.linha ? lineMap.get(o.linha) : null, String(o.turno).toUpperCase(), o.observacao || null],
      );
    }

    await client.query('COMMIT');
    res.json(await loadApontamento(id));
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error(e);
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'Já existe um apontamento desse usuário/setor para a data informada.' });
    }
    res.status(500).json({ error: 'Falha ao editar apontamento.' });
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, () => console.log(`ITAM API em http://localhost:${PORT}`));
