import type { Express } from 'express';
import type { Pool } from 'pg';

/** Somente leitura: checklist de prioridades, nunca altera dados. */
export function registerGestaoAtrasosRelatorio(
  app: Express,
  pool: Pool,
  auth: any,
  getAuthorizedSectors: (auth: any) => Promise<string[] | null>,
  activeRows: (scope?: string, bulkDone?: boolean) => string,
  selectedPeriod: (query: any) => {start:string;end:string;today:string},
  period: () => {today:string},
  sector: (value:unknown) => string,
) {
  app.get('/api/gestao-atrasos/relatorio-prioridades', auth, async (req:any,res) => {
    try {
      const allowed = await getAuthorizedSectors(req.auth);
      if (allowed !== null && !allowed.length) return res.json({hoje:period().today,rows:[]});
      const {start,end,today} = selectedPeriod(req.query);
      const op=String(req.query.op||'').trim();
      const serie=String(req.query.serie||'').trim();
      const setor=sector(req.query.setor);
      const linha=String(req.query.linha||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
      const cliente=String(req.query.cliente||'').trim();
      const situacao=String(req.query.situacao||'ATRASADOS');
      const justificativa=String(req.query.justificativa||'');
      const multiplos=req.query.multiplos==='true';
      const incluirHoje=req.query.incluirHoje==='true';
      if ((op&&!/^\d{1,20}$/.test(op)) || (serie&&!/^\d{1,20}$/.test(serie)) ||
        !['ATRASADOS','TODOS','CONCLUIDOS'].includes(situacao) ||
        (justificativa&&!['COM','SEM'].includes(justificativa)) ||
        (req.query.incluirHoje!==undefined&&!['true','false'].includes(req.query.incluirHoje)))
        return res.status(400).json({error:'Filtros inválidos.'});
      if (allowed!==null && setor && !allowed.includes(setor))
        return res.status(403).json({error:'Setor não autorizado.'});

      // Por padrão, apenas datas anteriores. Incluir hoje é opcional; nunca inclui futuras.
      const tomorrow=new Date(Date.parse(`${today}T00:00:00Z`)+86400000).toISOString().slice(0,10);
      const dayLimit=incluirHoje?tomorrow:today;
      const exclusiveEnd=end<dayLimit?end:dayLimit;
      const values=[allowed,setor||null,exclusiveEnd,start,op||null,serie||null,
        linha||null,cliente||null,today,situacao,justificativa,multiplos,incluirHoje];

      const result=await pool.query(`${activeRows('($1::text[] IS NULL OR p.setor=ANY($1::text[])) AND p.data_programada < $3::date')},
        scoped AS MATERIALIZED (
          SELECT p.*,a.data_produzida FROM prog p
          LEFT JOIN done a ON a.serie=p.serie AND a.setor=p.setor AND a.op=p.op
          WHERE ($1::text[] IS NULL OR p.setor=ANY($1::text[]))
            AND ($2::text IS NULL OR p.setor=$2) AND ($5::text IS NULL OR p.op=$5)
            AND ($6::text IS NULL OR p.serie=$6) AND ($7::text IS NULL OR p.linha=$7)
            AND ($8::text IS NULL OR p.cliente ILIKE '%'||$8||'%')
            AND p.data_programada >= $4::date AND p.data_programada < $3::date
        ), chosen_ops AS (SELECT DISTINCT op FROM scoped),
        full_prog AS MATERIALIZED (
          SELECT DISTINCT ON(p.serie,p.setor) p.serie,p.setor,p.op
          FROM public.atrasos_programacao_detalhada p
          JOIN public.atrasos_importacoes i ON i.id=p.importacao_id
            AND i.status='ATIVA' AND i.tipo='PROGRAMACAO'
          JOIN chosen_ops c ON c.op=p.op
          ORDER BY p.serie,p.setor,p.data_programada,p.op
        ), full_counts AS (
          SELECT p.op,p.setor,COUNT(*)::int total_setor,
            COUNT(a.data_produzida)::int produzido_setor
          FROM full_prog p LEFT JOIN done a
            ON a.serie=p.serie AND a.setor=p.setor AND a.op=p.op
          GROUP BY p.op,p.setor
        ), full_op AS (
          SELECT op,COUNT(DISTINCT serie)::int qtde_total_op FROM full_prog GROUP BY op
        ), grouped AS (
          SELECT s.op,s.setor,MAX(s.linha) linha,MAX(s.cliente) cliente,MAX(s.potencia) potencia,s.data_programada::text data_programada,
            COUNT(*)::int programada,COUNT(s.data_produzida)::int produzida,
            COUNT(*) FILTER(WHERE s.data_produzida IS NULL)::int pendente
          FROM scoped s GROUP BY s.op,s.setor,s.data_programada
        ), scope_counts AS (
          SELECT op,setor,COUNT(DISTINCT data_programada)::int dias_programados
          FROM scoped GROUP BY op,setor
        ), filtered AS (
          SELECT g.*,opq.qtde_total_op,fc.total_setor=fc.produzido_setor AS concluida,
            j.motivo,j.previsao_regularizacao::text
          FROM grouped g JOIN full_counts fc ON fc.op=g.op AND fc.setor=g.setor
          JOIN full_op opq ON opq.op=g.op
          JOIN scope_counts sc ON sc.op=g.op AND sc.setor=g.setor
          LEFT JOIN LATERAL (
            SELECT motivo,previsao_regularizacao FROM public.atrasos_justificativas
            WHERE op=g.op AND setor=g.setor ORDER BY criado_em DESC,id DESC LIMIT 1
          ) j ON true
          WHERE ($10='TODOS' OR ($10='ATRASADOS' AND
              ((g.data_programada<$9::text AND g.pendente>0)
                OR ($13::boolean AND g.data_programada=$9::text)))
            OR ($10='CONCLUIDOS' AND fc.total_setor=fc.produzido_setor))
            AND ($11='' OR ($11='COM' AND j.motivo IS NOT NULL) OR ($11='SEM' AND j.motivo IS NULL))
            AND (NOT $12::boolean OR sc.dias_programados>1)
        ) SELECT * FROM filtered
          ORDER BY setor,
            CASE WHEN data_programada<$9::text AND pendente>0 THEN 0
              WHEN data_programada=$9::text AND pendente>0 THEN 1 ELSE 2 END,
            data_programada,op,linha LIMIT 5001`,values);
      if(result.rows.length>5000)
        return res.status(413).json({error:'Relatório com mais de 5.000 linhas. Restrinja os filtros por setor, período ou OP.'});
      res.json({hoje:today,rows:result.rows});
    } catch(e) {
      res.status(e instanceof RangeError?400:500).json({error:e instanceof RangeError?e.message:'Falha ao gerar dados do relatório.'});
    }
  });
}
