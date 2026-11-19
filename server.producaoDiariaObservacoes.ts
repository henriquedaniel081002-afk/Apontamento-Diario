import type { Application, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  isDailyLine, isDailySector, isValidDailyObservationDate, isValidDailyObservationScope,
} from './src/producao-diaria/escopo.js';

export { isValidDailyObservationDate, isValidDailyObservationScope } from './src/producao-diaria/escopo.js';

const route = '/api/coordenacao/producao-diaria/observacoes';
const selection = 'data::text, setor, linha, observacao, atualizado_em, atualizado_por_login, versao';

export function registerProducaoDiariaObservacoesRoutes(
  app: Application,
  pool: Pool,
  auth: RequestHandler,
  requireCoordenacao: RequestHandler,
): void {
  app.get(route, auth, requireCoordenacao, async (req, res) => {
    const { dataInicio, dataFim, setor, linha } = req.query;
    if (!isValidDailyObservationDate(dataInicio) || !isValidDailyObservationDate(dataFim) || dataInicio > dataFim
      || (setor !== undefined && !isDailySector(setor)) || (linha !== undefined && !isDailyLine(linha))
      || (setor !== undefined && linha !== undefined && !isValidDailyObservationScope(setor, linha))) {
      res.status(400).json({ error: 'Informe datas e escopo válidos para consultar as observações.' });
      return;
    }
    try {
      const result = await pool.query(`
        SELECT ${selection}
          FROM public.producao_diaria_observacoes
         WHERE data BETWEEN $1::date AND $2::date
           AND ($3::text IS NULL OR setor = $3) AND ($4::text IS NULL OR linha = $4)
         ORDER BY data DESC, setor, linha
      `, [dataInicio, dataFim, setor ?? null, linha ?? null]);
      res.json({ observacoes: result.rows });
    } catch {
      console.error('Falha na consulta de observações da Produção Diária.');
      res.status(500).json({ error: 'Não foi possível carregar as observações da Produção Diária.' });
    }
  });

  app.put(route, auth, requireCoordenacao, async (req: any, res) => {
    const { data, setor, linha, observacao, versao } = req.body || {};
    if (!isValidDailyObservationDate(data) || !isValidDailyObservationScope(setor, linha)
      || typeof observacao !== 'string' || !observacao.trim() || observacao.trim().length > 3000 || observacao.includes('\u0000')
      || (versao !== undefined && versao !== null && (!Number.isInteger(versao) || versao < 1 || versao > 2147483647))) {
      res.status(400).json({ error: 'Informe data, setor, linha, versão e observação válidos (até 3.000 caracteres).' });
      return;
    }
    try {
      const parameters = [data, setor, linha, observacao.trim(), req.auth.userId, req.auth.login];
      const result = typeof versao === 'number'
        ? await pool.query(`
            UPDATE public.producao_diaria_observacoes
               SET observacao = $4, atualizado_por_id = $5, atualizado_por_login = $6, atualizado_em = now()
             WHERE data = $1 AND setor = $2 AND linha = $3 AND versao = $7
             RETURNING ${selection}
          `, [...parameters, versao])
        : await pool.query(`
            INSERT INTO public.producao_diaria_observacoes
              (data, setor, linha, observacao, atualizado_por_id, atualizado_por_login)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (data, setor, linha) ${versao === null ? 'DO NOTHING' : `
              DO UPDATE SET observacao = EXCLUDED.observacao,
                            atualizado_por_id = EXCLUDED.atualizado_por_id,
                            atualizado_por_login = EXCLUDED.atualizado_por_login,
                            atualizado_em = now()
            `}
            RETURNING ${selection}
          `, parameters);
      if (!result.rows[0]) {
        res.status(409).json({ error: 'A observação mudou desde a última leitura. Recarregue para comparar antes de salvar.' });
        return;
      }
      res.json({ observacao: result.rows[0] });
    } catch {
      console.error('Falha ao salvar observação da Produção Diária.');
      res.status(500).json({ error: 'Não foi possível salvar a observação.' });
    }
  });
}
