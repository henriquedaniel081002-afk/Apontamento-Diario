WITH prog AS (
    SELECT DISTINCT ON (p.serie,p.setor) p.serie,p.setor,p.op,p.data_programada,p.linha,p.cliente,p.potencia
    FROM public.atrasos_programacao_detalhada p
    JOIN public.atrasos_importacoes i ON i.id=p.importacao_id AND i.status='ATIVA' AND i.tipo='PROGRAMACAO'
    ORDER BY p.serie,p.setor,p.data_programada,p.op
  ), done AS (
    SELECT a.serie,a.setor,a.op,a.data_produzida
    FROM public.atrasos_apontamentos_detalhados a
    JOIN public.atrasos_importacoes i ON i.id=a.importacao_id AND i.status='ATIVA' AND i.tipo='APONTAMENTO'
  ), scoped AS (
        SELECT p.*,a.data_produzida
        FROM prog p LEFT JOIN done a ON a.serie=p.serie AND a.setor=p.setor AND a.op=p.op
        WHERE p.data_programada >= $1::date AND p.data_programada < $2::date
          AND ($4::text[] IS NULL OR p.setor=ANY($4::text[]))
          AND ($5::text IS NULL OR p.setor=$5)
          AND ($6::text IS NULL OR p.op=$6)
          AND ($7::text IS NULL OR p.serie=$7)
          AND ($8::text IS NULL OR p.linha=$8)
          AND ($9::text IS NULL OR p.cliente ILIKE '%'||$9||'%')
          AND p.data_programada BETWEEN $10::date AND $11::date
      ), grouped AS (
        SELECT op,setor,MAX(linha) linha,MAX(cliente) cliente,MAX(potencia) potencia,
          COUNT(*)::int programados,COUNT(data_produzida)::int produzidos,
          COUNT(*) FILTER(WHERE data_programada<$3::date AND data_produzida IS NULL)::int pendentes_vencidos,
          COUNT(*) FILTER(WHERE data_produzida>data_programada)::int produzidos_em_atraso,
          COUNT(DISTINCT data_programada)::int dias_programados,
          MIN(data_programada)::text primeira_data_programada,MAX(data_programada)::text ultima_data_programada,
          MAX(data_produzida) ultima_producao
        FROM scoped GROUP BY op,setor
      ), ready AS (
        SELECT g.*,j.motivo,j.previsao_regularizacao::text,j.usuario_login AS responsavel,j.criado_em,
          CASE WHEN g.programados=g.produzidos AND j.previsao_regularizacao IS NOT NULL
                 AND g.ultima_producao>j.previsao_regularizacao THEN 'CONCLUIDO_APOS_PRAZO'
            WHEN g.programados=g.produzidos THEN 'REGULARIZADO'
            WHEN j.previsao_regularizacao<$3::date AND g.pendentes_vencidos>0 THEN 'PRAZO_VENCIDO'
            WHEN g.pendentes_vencidos>0 AND j.id IS NULL THEN 'SEM_JUSTIFICATIVA'
            WHEN g.pendentes_vencidos>0 AND j.previsao_regularizacao IS NULL THEN 'SEM_PRAZO'
            WHEN g.pendentes_vencidos>0 THEN 'JUSTIFICADO' ELSE 'NO_PRAZO' END situacao
        FROM grouped g LEFT JOIN LATERAL (
          SELECT id,motivo,previsao_regularizacao,usuario_login,criado_em
          FROM public.atrasos_justificativas WHERE op=g.op AND setor=g.setor
          ORDER BY criado_em DESC,id DESC LIMIT 1
        ) j ON true
      )
      SELECT *,COUNT(*) OVER()::int total FROM ready
      WHERE ($12='TODOS' OR ($12='ATRASADOS' AND (pendentes_vencidos>0 OR produzidos_em_atraso>0))
        OR ($12='PENDENTES' AND pendentes_vencidos>0)
        OR ($12='CONCLUIDOS' AND programados=produzidos)
        OR ($12='PRAZO_VENCIDO' AND situacao='PRAZO_VENCIDO'))
        AND ($13='' OR ($13='COM' AND motivo IS NOT NULL) OR ($13='SEM' AND motivo IS NULL))
        AND (NOT $14::boolean OR dias_programados>1)
      ORDER BY pendentes_vencidos DESC,ultima_data_programada DESC,op DESC,setor
      LIMIT 50 OFFSET $15