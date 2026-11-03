-- PROPOSTA PARA REVISÃO. NÃO EXECUTADA. NÃO É MIGRAÇÃO DE INSTALAÇÃO.

-- Usar apenas em ambiente autorizado; não chamar RPCs para testar permissões.

BEGIN TRANSACTION READ ONLY;

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS assinatura,

       p.prosecdef, p.proacl, pg_get_functiondef(p.oid) AS definicao

FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace

WHERE n.nspname='public' AND p.proname IN ('excluir_registros_mes','importar_produtividade');

SELECT column_name,data_type FROM information_schema.columns

WHERE table_schema='public' AND table_name='vw_producao_detalhada'

ORDER BY ordinal_position;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies

WHERE schemaname='public' AND tablename IN ('producao','jornada_colaborador','colaboradores_controle');

SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes

WHERE schemaname='public' AND tablename IN ('atrasos_programacao_detalhada','atrasos_apontamentos_detalhados');

ROLLBACK;

-- Somente após validar identidade, fluxo substituto e obter autorização:

-- BEGIN;

-- REVOKE EXECUTE ON FUNCTION public.excluir_registros_mes(<assinatura confirmada>) FROM PUBLIC, anon;

-- REVOKE EXECUTE ON FUNCTION public.importar_produtividade(<assinatura confirmada>) FROM PUBLIC, anon;

-- GRANT EXECUTE ON FUNCTION public.<funcao>(<assinatura confirmada>) TO <papel_backend_minimo>;

-- ALTER VIEW public.vw_producao_detalhada SET (security_invoker=true);

-- COMMIT;

-- Os placeholders exigem revisão. Não descomentar em produção sem plano e autorização.

-- Não há novos índices, ANALYZE, VACUUM ou exclusões propostos para execução automática.
