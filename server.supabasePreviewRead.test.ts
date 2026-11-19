// @vitest-environment node
import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { registerSupabasePreviewRead } from './server.supabasePreviewRead';

const request = globalThis.fetch.bind(globalThis);
const origin = 'https://fixture.supabase.co';
const route = '/api/homologacao/supabase/rest/v1/';
const config = { environment: 'preview', origin, anonKey: 'anon-fixture' };
const upstream = vi.fn(async (_url, _init) => new Response('[]', {
  headers: { 'content-type': 'application/json', 'content-range': '0-0/1' },
}));
const app = express();
const production = express();
const auth: express.RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) return void res.sendStatus(401);
  Object.assign(req, { auth: { userId: 1, perfil: req.headers.authorization } });
  next();
};
const access = vi.fn(async () => [{ setor: 'BOBINA AT/BT' }]);
registerSupabasePreviewRead(app, auth, access, config);
registerSupabasePreviewRead(production, auth, access, { ...config, environment: 'production' });

const previewServer = app.listen(0, '127.0.0.1');
const productionServer = production.listen(0, '127.0.0.1');
beforeAll(async () => {
  for (const s of [previewServer, productionServer]) {
    if (!s.listening) await new Promise<void>(resolve => s.once('listening', resolve));
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(upstream);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await Promise.all([previewServer, productionServer].map(s => new Promise<void>(resolve => s.close(() => resolve()))));
});
function call(path: string, method = 'GET', profile: string | null = 'COORDENACAO', target = previewServer) {
  return request('http://127.0.0.1:' + (target.address() as AddressInfo).port + route + path, {
    method, headers: profile ? { authorization: profile } : {},
  });
}

describe('consulta Supabase da homologação', () => {
  it('encaminha uma consulta com credencial anônima e devolve paginação', async () => {
    upstream.mockClear();
    const result = await call('vw_producao_detalhada?select=id,data&order=data.asc,id.asc&offset=0&limit=1000');
    expect(result.status).toBe(200);
    expect(result.headers.get('content-range')).toBe('0-0/1');
    const [url, init] = upstream.mock.calls[0];
    expect(url.hostname).toBe('fixture.supabase.co');
    expect(url.pathname).toBe('/rest/v1/vw_producao_detalhada');
    expect(init.headers).toEqual({ apikey: 'anon-fixture', authorization: 'Bearer anon-fixture' });
  });

  it('bloqueia gravação, RPC, consulta embutida e acesso sem sessão', async () => {
    upstream.mockClear();
    expect((await call('aderencia_anual', 'POST')).status).toBe(405);
    expect((await call('aderencia_anual', 'DELETE')).status).toBe(405);
    expect((await call('usuarios')).status).toBe(404);
    expect((await call('aderencia_anual?select=mes,usuarios(*)')).status).toBe(400);
    expect((await call('aderencia_anual', 'GET', null)).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('preserva a autorização de leitura e não registra a rota em produção', async () => {
    expect((await call('aderencia_anual', 'GET', 'APONTADOR')).status).toBe(403);
    expect((await call('dias_trabalho?dia_trabalho=eq.true', 'GET', 'APONTADOR')).status).toBe(200);
    expect((await call('aderencia_anual', 'GET', 'COORDENACAO', productionServer)).status).toBe(404);
  });
});
