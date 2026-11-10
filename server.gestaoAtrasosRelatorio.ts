import type { Express } from 'express';
import type { Pool } from 'pg';

type ReportFilters = {
  today: string;
  setor: string;
  situacao: string;
  values: unknown[];
};

export function registerGestaoAtrasosRelatorio(
  app: Express,
  pool: Pool,
  auth: any,
  getAuthorizedSectors: (auth: any) => Promise<string[] | null>,
  dailyFilters: (query: any, allowed: string[] | null) => ReportFilters,
  dailyRows: string,
  opTotals: string,
  sectorComplete: string,
) {
  app.get('/api/gestao-atrasos/relatorio-prioridades', auth, async (req:any,res) => {
    try {
      const allowed=await getAuthorizedSectors(req.auth);
      const {today,setor,values,situacao}=dailyFilters(req.query,allowed);
      if (allowed!==null && setor && !allowed.includes(setor)) {
        return res.status(403).json({error:'Setor não autorizado.'});
      }
      if (req.query.incluirHoje!==undefined && !['true','false'].includes(req.query.incluirHoje)) {
        return res.status(400).json({error:'Opção de relatório inválida.'});
      }
      if (allowed!==null && !allowed.length) return res.json({hoje:today,rows:[]});

      const result=await pool.query(`${dailyRows}, page_rows AS (
        SELECT * FROM ready
        WHERE situacao<>'SEM_APONTAMENTO'
          AND (pendentes_vencidos>0 OR ($12::boolean AND data_programada=$3::date))
          AND ($13<>'CONCLUIDOS' OR (programados=produzidos AND ${sectorComplete}))
        ORDER BY data_programada,op,setor LIMIT 5001
      ), ${opTotals}
      SELECT r.op,r.setor,r.linha,r.cliente,r.potencia,r.referencia,r.data_programada::text,
        t.qtde_total_op,r.programados AS programada,r.produzidos AS produzida,
        r.programados-r.produzidos AS pendente,r.programados=r.produzidos AS concluida,
        r.situacao,r.motivo,r.previsao_regularizacao
      FROM page_rows r JOIN op_totals t USING(op)
      ORDER BY r.data_programada,r.op,r.setor`,[...values,req.query.incluirHoje==='true',situacao]);

      if (result.rows.length>5000) {
        return res.status(413).json({error:'Relatório com mais de 5.000 linhas. Restrinja os filtros por setor, período ou OP.'});
      }
      res.json({hoje:today,rows:result.rows});
    } catch(e) {
      res.status(e instanceof RangeError?400:500).json({error:e instanceof RangeError?e.message:'Falha ao gerar dados do relatório.'});
    }
  });
}
