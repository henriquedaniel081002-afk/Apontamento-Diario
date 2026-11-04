# Segurança — PROPOSTA NÃO EXECUTADA

Os achados abaixo pertencem ao relatório obrigatório de auditoria de 03/11/2026. Não foram novamente consultados nos provedores nesta missão. Não houve revogação, mudança de autenticação, política RLS, usuários, chaves, TLS ou configuração real.

## Prioridade e roteiro

1. **Alta: RPCs privilegiadas.** Auditoria relata `importar_produtividade`, `excluir_registros_mes` e `rls_auto_enable` SECURITY DEFINER executáveis por anon. O frontend usa chave anon e o backend JWT próprio, sem sessão Supabase Auth. Revogar imediatamente quebraria fluxos; não copiar service_role para o navegador.
2. Em homologação autorizada, inventariar assinaturas, donos, grants efetivos (incluindo PUBLIC), schema/search_path e todos os chamadores. Criar ponte no backend que valida JWT próprio, perfil e operação; usar papel servidor com acesso mínimo, validação de payload e rastreabilidade. Não aceitar perfil/setor enviado pelo cliente como autorização.
3. Para produtividade, projetar staging isolado por sessão/importação, contagem esperada, limites, replay e finalização transacional. Manter substituição integral de produção/jornada, horas extras por matrícula/data e arquivo de desligados. Definir exclusão de staging expirado sem afetar base ativa. A implementação remota não está contida no ZIP; sua definição precisa ser obtida em ambiente autorizado antes de escrever migração revisável.
4. Testar coordenação, apontador/líder, token inválido/expirado e chamadas diretas anônimas; falhas no lote/finalização não podem substituir a base ativa. Validar simultaneidade e timeout sem duplicar importações.
5. Somente após migrar e testar os consumidores, propor revogação específica de PUBLIC/anon e concessão mínima ao papel servidor. Solicitar autorização para execução e janela de rollback. Nunca aplicar revogação em massa sem dependências.
6. **View e RLS:** auditoria relata view `vw_producao_detalhada` privilegiada e seis tabelas com RLS sem políticas. Inventariar os nomes e fluxos em homologação; não inventar políticas genéricas auth.uid(), pois o sistema usa JWT próprio. Comparar security_invoker/ponte servidor, com visibilidade e aliases compatíveis. Projeção de 18 campos permanece opt-in desligada.
7. **Backend:** planejar SESSION_SECRET obrigatório e rotação sem quebra de sessões inesperada; substituir rejectUnauthorized:false por validação de certificado/CA adequada depois de testar conexão autorizada. Fallback de Atrasos para DATABASE_URL é legado; confirmar destino sem imprimir valores antes de mudar.
8. Tratar as vulnerabilidades npm herdadas com identificação de caminho, exposição e atualização direcionada; manter lock e rodar regressões. Não executar correções forçadas junto desta otimização.

## Aceite e reversão

Salvar definições/grants anteriores em local privado autorizado; registrar alterações e responsáveis. Primeiro disponibilizar ponte compatível, migrar consumidores, provar regras e só então restringir acesso. Rollback deve restaurar somente privilégios aprovados e aplicação compatível; restaurar código não recupera linhas já substituídas por importação. Backup/snapshot e recuperação de dados exigem plano próprio.

Documentação consultada para revisão: [RLS e views](https://supabase.com/docs/guides/database/postgres/row-level-security) e [funções e privilégios](https://supabase.com/docs/guides/database/functions). São referências de implementação, não prova do estado dos projetos. Changelog consultado; sem mudança de SDK/CLI nesta entrega.
