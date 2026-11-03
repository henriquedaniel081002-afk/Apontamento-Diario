# Plano separado de segurança e banco — NÃO EXECUTADO



As evidências da auditoria fornecida são de 30/10/2026; não foram reconsultadas em produção. Não representam configuração confirmada em 03/11/2026. Esta atualização não modifica credenciais, políticas, grants, índices, schema ou limites de pool.



1. Em homologação autorizada, obter assinaturas e definições de `excluir_registros_mes` e `importar_produtividade`, privilégios efetivos, uso atual e políticas das tabelas. Não expor chaves privilegiadas no navegador.

2. Preparar um caminho autenticado no backend que valide perfil, período, tamanho e payload e invoque a função com um papel de privilégio mínimo. O login próprio do sistema não equivale automaticamente a uma sessão Supabase Auth. Testar negações e preservação das importações/exclusões antes da troca.

3. Só depois da migração do cliente e autorização, revogar EXECUTE de PUBLIC/anon e conceder ao papel do backend. Avaliar authenticated conforme o modelo de identidade decidido. Esta entrega mantém as chamadas existentes para não interromper o fluxo.

4. Para `vw_producao_detalhada`, validar colunas e políticas de tabelas subjacentes antes de `security_invoker=true`. Verificar se `colaboradores_controle` tem políticas compatíveis; a auditoria encontrou RLS ativo sem policy. Não criar uma policy `USING (true)` como correção genérica.

5. Migrar o fallback de SESSION_SECRET para configuração obrigatória e TLS para cadeia CA verificada em implantação separada. Preservado neste pacote para evitar quebrar sessões/conexões sem a configuração real; os riscos preexistentes NÃO estão resolvidos.

6. Não criar/remover índices. Capturar planos em homologação com estatísticas e distribuição representativas. Os índices atuais já cobrem importação/data, OP/setor e série/setor. Um índice sem scans no snapshot não comprova redundância.



O arquivo `SQL_PROPOSTO_NAO_EXECUTAR.sql` contém inventário somente leitura e exemplos comentados, não uma migração executável. O material original da auditoria está em `docs/referencia`. Nenhum EXPLAIN ANALYZE foi executado em bancos reais.
