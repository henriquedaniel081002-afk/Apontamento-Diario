import type { Express, RequestHandler } from 'express';

const route = '/api/homologacao/supabase/rest/v1/:resource';
const productivity = new Set(['vw_producao_detalhada', 'dias_trabalho', 'colaboradores_controle', 'colaboradores_desligados']);
const queryKeys = new Set(['select', 'order', 'offset', 'limit', 'dia_trabalho']);
const columns = /^(?:\*|[a-z][a-z0-9_]*(?:,[a-z][a-z0-9_]*)*)$/i;
const order = /^[a-z][a-z0-9_]*\.(?:asc|desc)(?:,[a-z][a-z0-9_]*\.(?:asc|desc))*$/i;

interface PreviewConfig {
  environment?: string;
  origin?: string;
  anonKey?: string;
}

export function registerSupabasePreviewRead(
  app: Express, auth: RequestHandler,
  getAccess: (id: number) => Promise<Array<{ setor: string }>>,
  config: PreviewConfig,
) {
  const { environment, origin, anonKey } = config;
  if (environment !== 'preview' || !origin || !anonKey || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(origin)) return;

  app.all(route, auth, async (req, res) => {
    const { resource } = req.params;
    const productivityResource = productivity.has(resource);
    if (!productivityResource && resource !== 'aderencia_anual') return res.sendStatus(404);
    if (req.method !== 'GET') {
      return res.set('Allow', 'GET').status(405).json({ message: 'Na prévia, esta base está disponível somente para consulta.' });
    }

    const { perfil, userId } = (req as typeof req & { auth: { perfil?: string; userId: number } }).auth;
    try {
      if (perfil !== 'COORDENACAO') {
        const allowed = productivityResource && perfil === 'APONTADOR' &&
          (await getAccess(userId)).some(({ setor }) => setor.trim().toUpperCase() === 'BOBINA AT/BT');
        if (!allowed) return res.sendStatus(403);
      }
      const query = new URL(req.originalUrl, 'http://localhost').searchParams;
      for (const [name, value] of query) {
        const valid = queryKeys.has(name) && (
          name === 'select' ? columns.test(value)
            : name === 'order' ? order.test(value)
              : name === 'dia_trabalho' ? resource === 'dias_trabalho' && value === 'eq.true'
                : /^[0-9]{1,9}$/.test(value)
        );
        if (!valid) return res.status(400).json({ message: 'Filtro de consulta inválido.' });
      }
      const target = new URL('/rest/v1/' + resource, origin);
      target.search = query.toString();
      const result = await fetch(target, {
        headers: { apikey: anonKey, authorization: 'Bearer ' + anonKey },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      for (const name of ['content-type', 'content-range', 'range-unit']) {
        const value = result.headers.get(name);
        if (value) res.set(name, value);
      }
      return res.status(result.status).send(await result.text());
    } catch {
      return res.status(502).json({ message: 'Não foi possível consultar a base na prévia.' });
    }
  });
}
