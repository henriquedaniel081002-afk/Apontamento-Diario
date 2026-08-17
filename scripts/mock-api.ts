import express from 'express';
import type { Apontamento, Setor, TipoBobina, User } from '../src/types';

const app = express();
const port = 3001;

app.use(express.json({ limit: '1mb' }));

const users: Record<string, User> = {
  Bobinagem: {
    id: 'mock-bobinagem',
    name: 'Bobinagem',
    perfil: 'APONTADOR',
    setor: 'BOBINA AT/BT',
    linhas: ['MON', 'TRI'],
  },
  'Montagem Final MON': {
    id: 'mock-montagem-final-mon',
    name: 'Montagem Final MON',
    perfil: 'APONTADOR',
    setor: 'MONTAGEM FINAL',
    linhas: ['MON'],
  },
  COORDENAÇÃO: {
    id: 'mock-coordenacao',
    name: 'COORDENAÇÃO',
    perfil: 'COORDENACAO',
    setor: null,
    linhas: [],
  },
};

function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousWorkingDay(): string {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 1 ? 3 : day === 0 ? 2 : 1));
  return formatLocalYmd(date);
}

const referenceDate = previousWorkingDay();
let nextId = 104;
let rows: Apontamento[] = [
  {
    id: '101',
    data: referenceDate,
    setor: 'BOBINA AT',
    tipoBobina: 'AT',
    userId: users.Bobinagem.id,
    userName: users.Bobinagem.name,
    linhasPermitidas: ['MON', 'TRI'],
    producoes: [
      { id: 'p-101-1', linha: 'MON', potencia: 75, potenciaFormatted: '75', quantidade: 12 },
      { id: 'p-101-2', linha: 'TRI', potencia: 112.5, potenciaFormatted: '112,5', quantidade: 8 },
    ],
    faltas: [
      {
        id: 'f-101-1',
        linha: 'MON',
        turno: '1º turno',
        quantidade: 1,
        justificativa: 'Atestado médico — dado fictício',
      },
    ],
    observacoes: [
      {
        id: 'o-101-1',
        linha: 'TRI',
        turno: '2º turno',
        observacao: 'Parada fictícia de 20 minutos para ajuste.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '102',
    data: referenceDate,
    setor: 'MONTAGEM FINAL',
    userId: users['Montagem Final MON'].id,
    userName: users['Montagem Final MON'].name,
    linhasPermitidas: ['MON'],
    producoes: [
      { id: 'p-102-1', linha: 'MON', potencia: 150, potenciaFormatted: '150', quantidade: 6 },
    ],
    faltas: [],
    observacoes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function userFromRequest(req: express.Request): User | undefined {
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer mock:')) return undefined;
  const login = decodeURIComponent(authorization.slice('Bearer mock:'.length));
  return users[login];
}

function requireMockAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sessão fictícia inválida ou expirada.' });
  res.locals.user = user;
  next();
}

function requireMockCoordination(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as User;
  if (user.perfil !== 'COORDENACAO') {
    return res.status(403).json({ error: 'Acesso permitido somente para a COORDENAÇÃO.' });
  }
  next();
}

function replaceCollections(current: Apontamento, body: Partial<Apontamento>): Apontamento {
  return {
    ...current,
    data: String(body.data || current.data),
    producoes: body.producoes || [],
    faltas: body.faltas || [],
    observacoes: body.observacoes || [],
    updatedAt: new Date().toISOString(),
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, mock: true }));

app.post('/api/auth/login', (req, res) => {
  const login = String(req.body?.login || '');
  const password = String(req.body?.password || '');
  const user = users[login];

  if (!login || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });
  if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

  return res.json({ user, token: `mock:${encodeURIComponent(login)}` });
});

app.get('/api/apontamentos', requireMockAuth, (_req, res) => {
  const user = res.locals.user as User;
  res.json(rows.filter((item) => item.userId === user.id));
});

app.post('/api/apontamentos', requireMockAuth, (req, res) => {
  const user = res.locals.user as User;
  if (user.perfil === 'COORDENACAO') {
    return res.status(403).json({ error: 'A COORDENAÇÃO não cria apontamentos.' });
  }

  const tipoBobina = String(req.body?.tipoBobina || '') as TipoBobina;
  if (user.setor === 'BOBINA AT/BT' && !['AT', 'BT'].includes(tipoBobina)) {
    return res.status(400).json({ error: 'Selecione o tipo de bobina AT ou BT.' });
  }

  const now = new Date().toISOString();
  const record: Apontamento = {
    id: String(nextId++),
    data: String(req.body.data),
    setor: user.setor === 'BOBINA AT/BT' ? (`BOBINA ${tipoBobina}` as Setor) : user.setor!,
    tipoBobina: user.setor === 'BOBINA AT/BT' ? tipoBobina : undefined,
    userId: user.id,
    userName: user.name,
    linhasPermitidas: user.linhas,
    producoes: req.body.producoes || [],
    faltas: req.body.faltas || [],
    observacoes: req.body.observacoes || [],
    createdAt: now,
    updatedAt: now,
  };

  rows = [record, ...rows];
  res.json(record);
});

app.put('/api/apontamentos/:id', requireMockAuth, (req, res) => {
  const user = res.locals.user as User;
  const index = rows.findIndex((item) => item.id === req.params.id && item.userId === user.id);
  if (index < 0) return res.status(404).json({ error: 'Registro não encontrado.' });
  rows[index] = replaceCollections(rows[index], req.body);
  res.json(rows[index]);
});

app.delete('/api/apontamentos/:id', requireMockAuth, (req, res) => {
  const user = res.locals.user as User;
  const before = rows.length;
  rows = rows.filter((item) => !(item.id === req.params.id && item.userId === user.id));
  if (rows.length === before) return res.status(404).json({ error: 'Registro não encontrado.' });
  res.json({ ok: true });
});

app.get('/api/coordenacao/apontamentos', requireMockAuth, requireMockCoordination, (_req, res) => {
  res.json(rows);
});

app.put('/api/coordenacao/apontamentos/:id', requireMockAuth, requireMockCoordination, (req, res) => {
  const index = rows.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Registro não encontrado.' });
  rows[index] = replaceCollections(rows[index], req.body);
  res.json(rows[index]);
});

app.delete('/api/coordenacao/apontamentos/:id', requireMockAuth, requireMockCoordination, (req, res) => {
  const before = rows.length;
  rows = rows.filter((item) => item.id !== req.params.id);
  if (rows.length === before) return res.status(404).json({ error: 'Registro não encontrado.' });
  res.json({ ok: true });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`API fictícia ITAM disponível em http://127.0.0.1:${port}`);
});
