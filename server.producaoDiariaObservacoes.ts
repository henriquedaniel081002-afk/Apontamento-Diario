import type { Application, RequestHandler } from 'express';
import type { Pool } from 'pg';

export type DailyObservationLine = 'GERAL' | 'MON' | 'TRI';

export function isValidDailyObservationDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidDailyObservationScope(setor: unknown, linha: unknown): boolean {
  if (typeof setor !== 'string' || !setor.trim() || setor.length > 100 || setor !== setor.trim().toUpperCase()) return false;
  // Uma observação geral por setor e data, sem diferenciação por linha.
  return linha === 'GERAL';
}

/** Rotas isoladas: nenhum apontamento ou ocorrência operacional é alterado. */
export function registerProducaoDiariaObservacoesRoutes(
  app: Application,
  pool: Pool,
  auth: RequestHandler,
  requireCoordenacao: RequestHandler,
): void {
  app.get('/api/coordenacao/producao-diaria/observacoes', auth, requireCoordenacao, async (req, res) => {
    const { dataInicio, dataFim } = req.query;
    if (!isValidDailyObservationDate(dataInicio) || !isValidDailyObservationDate(dataFim) || dataInicio > dataFim) {
      res.status(400).json({ error: 'Informe datas válidas para consultar as observações.' });
      return;
    }
    try {
      const result = await pool.query(`
        SELECT data::text, setor, linha, observacao, atualizado_em, atualizado_por_login
          FROM producao_diaria_observacoes
         WHERE data BETWEEN $1::date AND $2::date AND linha = 'GERAL'
         ORDER BY data DESC, setor, linha
      `, [dataInicio, dataFim]);
      res.json({ observacoes: result.rows });
    } catch (error) {
      console.error('Falha na consulta de observações da Produção Diária.', error);
      res.status(500).json({ error: 'Não foi possível carregar as observações da Produção Diária.' });
    }
  });

  app.put('/api/coordenacao/producao-diaria/observacoes', auth, requireCoordenacao, async (req: any, res) => {
    const { data, setor, linha, observacao } = req.body || {};
    if (!isValidDailyObservationDate(data) || !isValidDailyObservationScope(setor, linha)
      || typeof observacao !== 'string' || observacao.trim().length < 1 || observacao.trim().length > 3000) {
      res.status(400).json({ error: 'Informe data, setor, linha e observação válidos (até 3.000 caracteres).' });
      return;
    }
    try {
      const result = await pool.query(`
        INSERT INTO producao_diaria_observacoes
          (data, setor, linha, observacao, atualizado_por_id, atualizado_por_login)
        VALUES ($1::date, $2, $3, $4, $5, $6)
        ON CONFLICT (data, setor, linha)
        DO UPDATE SET observacao = EXCLUDED.observacao,
                      atualizado_por_id = EXCLUDED.atualizado_por_id,
                      atualizado_por_login = EXCLUDED.atualizado_por_login,
                      atualizado_em = NOW()
        RETURNING data::text, setor, linha, observacao, atualizado_em, atualizado_por_login
      `, [data, setor, linha, observacao.trim(), req.auth.userId, req.auth.login]);
      res.json({ observacao: result.rows[0] });
    } catch (error) {
      console.error('Falha ao salvar observação da Produção Diária.', error);
      res.status(500).json({ error: 'Não foi possível salvar a observação.' });
    }
  });
}
