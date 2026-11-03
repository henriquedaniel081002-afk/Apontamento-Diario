-- APONTAMENTO DIÁRIO ITAM — CONSULTAS DE DIAGNÓSTICO, SOMENTE LEITURA
-- Execute individualmente APENAS no banco correto.
-- NÃO executar no banco produtivo com EXPLAIN ANALYZE, VACUUM, ANALYZE,
-- CREATE/ALTER/DROP/GRANT/REVOKE ou mudanças de sessão.

-- NEON Apontamento / neondb
SELECT relname AS tabela, n_live_tup AS linhas_estimadas, seq_scan, idx_scan, n_dead_tup
FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 30;

SELECT relname AS tabela, indexrelname AS indice, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS tamanho
FROM pg_stat_user_indexes WHERE schemaname='public'
ORDER BY relname,idx_scan DESC LIMIT 70;

SELECT state,wait_event_type,count(*) AS sessoes
FROM pg_stat_activity WHERE datname=current_database()
GROUP BY 1,2 ORDER BY sessoes DESC LIMIT 20;

SELECT stats_reset FROM pg_stat_statements_info;

-- SUPABASE Prod_individual
SELECT c.relname tabela,c.reltuples::bigint linhas_estimadas,
       pg_size_pretty(pg_total_relation_size(c.oid)) tamanho_total,
       COALESCE(st.seq_scan,0) seq_scans, COALESCE(st.idx_scan,0) idx_scans
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_stat_user_tables st ON st.relid=c.oid
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 30;

SELECT tablename,indexname,indexdef
FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname LIMIT 100;

SELECT calls,round(total_exec_time::numeric,1) AS total_ms,
       round(mean_exec_time::numeric,2) AS media_ms,
       round(max_exec_time::numeric,1) AS max_ms,
       left(regexp_replace(query,'[[:space:]]+',' ','g'),260) AS sql_resumo
FROM pg_stat_statements
WHERE query ILIKE '%atrasos_%' OR query ILIKE '%vw_producao_detalhada%'
ORDER BY total_exec_time DESC LIMIT 30;

SELECT stats_reset FROM pg_stat_statements_info;

SELECT tipo,status,esperado,atualizado_em
FROM public.atrasos_importacoes ORDER BY tipo,status LIMIT 10;

SELECT p.proname,p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_pode_executar
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
('excluir_registros_mes','importar_produtividade','rls_auto_enable')
ORDER BY p.proname;

SELECT c.relname tabela,c.relrowsecurity rls,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
('colaboradores_controle','atrasos_programacao_detalhada','atrasos_apontamentos_detalhados','atrasos_importacoes')
ORDER BY c.relname;
