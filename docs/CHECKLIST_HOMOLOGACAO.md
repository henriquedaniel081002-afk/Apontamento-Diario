# Checklist de homologação e rollback

## Já validado localmente

- [x] Origem preservada por SHA-256; cópia separada; sem credenciais/produção.
- [x] Typecheck, 244 testes, build, SQL/Neon herdados e novos comparativos.
- [x] Canônica série/setor, desempate, filtros combinados, limites de datas Manaus, mês/ano e páginas vazias com total/KPIs.
- [x] Coordenação, setores autorizados/sem acesso, opções restritas e progresso de OP visível.
- [x] Lotes sequenciais, replay idêntico, conflito, finalização incompleta/repetida, rollback e preservação de registros manuais.
- [x] Histórico completo/horas extras/desligados da produtividade em fixtures; igualdade de preview XLSX.
- [x] Screenshots desktop/mobile Mensal e OP, seleção por clique e teclado, Epóxi, modal e justificativa local.

## Pendente em ambiente autorizado

- [ ] Confirmar DATABASE_URL → Neon Apontamento, ATRASO_DATABASE_URL/SUPABASE_DATABASE_URL → Supabase Prod_individual, VITE_SUPABASE_* → projeto correto; não imprimir segredos. Confirmar versão publicada separadamente.
- [ ] Snapshot mascarado representativo, versões do PostgreSQL, índices, constraints, triggers, grants e view; repetir equivalência e plano somente nessa cópia.
- [ ] Login/logout/expiração, apontador com um e múltiplos setores, coordenação, acesso direto indevido; dois usuários/sessões e invalidação de cache.
- [ ] Apontamento diário, turnos, faltas, observações, paradas de material/máquina, não conformidades/reparo, complemento, aprovação e histórico.
- [ ] Coordenação/registros, Aderência Mensal/Anual, Produção Diária, Controle de Faltas, Produtividade, Atraso Série e exportação/impressão íntegra.
- [ ] MON/TRI/EPO/BOBINA, Epóxi e nomes equivalentes, AT/BT, turno, associação de apontador; admissão/primeira produção, desligados e hora extra.
- [ ] OP: período padrão/anterior+atual Manaus, datas inclusivas, filtros/limpeza, múltiplos dias, ausência de apontamento, pendente futuro, justificativa vencida, páginas de 50, modal/histórico.
- [ ] Importação diária/mensal, programação, Série, OP programação/apontamento, produtividade e anual com XLSX reais mascarados; totais e conteúdo antes/depois. Validar arquivo máximo de 200 mil e recuperação de interrupção real.
- [ ] Falha de um dia não desfaz dia anterior confirmado. Importação mensal fracionada NÃO é atômica para o mês. Reimportação não perde filhos manuais nem complementos.
- [ ] Carga concorrente, usuários/lotes paralelos e mudanças de base durante leitura paginada; não presumir snapshot entre páginas.
- [ ] Medir 30+ amostras pareadas frias/quentes por perfil e seletividade, navegação/SQL/HTTP/parse/validação/finalização; mesma carga, ambiente e período. Confirmar p95 com amostragem mais robusta.
- [ ] Medir por turno CPU/CU, RAM, conexões, I/O, egress, WAL/linhas escritas e custo nos provedores. Consumo igual ou menor permanece NÃO VALIDADO até comparação equivalente.
- [ ] Revisar vulnerabilidades herdadas e plano de segurança separado; sem revogar acesso antes da migração dos consumidores.
- [ ] Aceite operacional e autorização explícita antes de publicar, mudar variáveis, aplicar SQL ou operar bancos reais.

## Execução local segura

Node 22.x. Extraia o ZIP em pasta nova, não copie .env nem credenciais. `npm ci`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:sql`, `npm run test:neon`, `npm run test:audit-sql`, `npm run test:imports`, `npm run benchmark:productivity`. São testes de mocks/PGlite. O build fornecido foi feito sem VITE_SUPABASE_* e é referência de compilação, não configuração de produção.

`npm run preview:local` inicia mock PGlite em 127.0.0.1:4320 e Vite em 127.0.0.1:4321. Para navegação sintética siga evidencias/reproducao/README.md. Não execute `npm run server`, `npm run dev` ou `npm start` apontando para produção nesta validação: o backend real continua usando suas conexões/configuração e pode executar inicialização de schema legado. Não rode SQLs de instalação automaticamente.

## Rollback

Esta entrega não alterou schema remoto: reversão da aplicação usa a cópia original preservada, restaurando configuração somente pelo responsável autorizado. Não execute diff reverso sobre uma pasta de trabalho com mudanças alheias. Homologue o original e candidato separadamente.

Interrompa novas importações e preserve evidências caso haja divergência. Rollback de código não desfaz dados já importados nem recupera base substituída. Uma importação OP pendente não substitui a ativa; uma finalização concluída é mutação efetiva. Produção mensal confirma por data, não por mês. Recuperação exige backup/snapshot específico e autorização; não oferecer SQL destrutivo genérico.
